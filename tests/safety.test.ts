import { describe, expect, test } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blocks, needs, reports, users, type User } from "@/lib/db/schema";
import {
  blockUser,
  moderateContent,
  resolveReport,
  submitReport,
  unblockUser,
} from "@/lib/safety-service";
import { QUOTAS } from "@/lib/quota";
import { SERVER_DICTS } from "@/lib/i18n/dict";
import { fmt } from "@/lib/i18n/fmt";

const t = SERVER_DICTS.zh;
const DAY = 24 * 60 * 60 * 1000;

let userSeq = 0;

async function createUser(): Promise<User> {
  const seq = ++userSeq;
  const [user] = await db
    .insert(users)
    .values({
      loginEmail: `safety-${seq}@test.local`,
      nickname: `治理用户${seq}`,
    })
    .returning();
  return user;
}

function report(reporter: User, targetId: number, targetType = "user") {
  return submitReport(
    reporter,
    { targetType, targetId, reason: "spam", details: "" },
    t,
  );
}

describe("submitReport", () => {
  test("正常提交后落库", async () => {
    const reporter = await createUser();
    const target = await createUser();
    expect(await report(reporter, target.id)).toEqual({ ok: t.report.submitted });
    const rows = await db
      .select()
      .from(reports)
      .where(eq(reports.reporterId, reporter.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
  });

  test("不能举报自己，原因非法被拒", async () => {
    const reporter = await createUser();
    expect(await report(reporter, reporter.id)).toEqual({
      error: t.report.selfReport,
    });
    expect(
      await submitReport(
        reporter,
        { targetType: "user", targetId: 1, reason: "怎么了", details: "" },
        t,
      ),
    ).toEqual({ error: t.report.badReason });
  });

  test("同一目标有 pending 时按已收到处理，不新增记录", async () => {
    const reporter = await createUser();
    const target = await createUser();
    await report(reporter, target.id);
    expect(await report(reporter, target.id)).toEqual({
      ok: t.report.duplicate,
    });
    const rows = await db
      .select()
      .from(reports)
      .where(eq(reports.reporterId, reporter.id));
    expect(rows).toHaveLength(1);
  });

  test("处理完成后 7 天内不能再举报同一目标", async () => {
    const reporter = await createUser();
    const target = await createUser();
    await report(reporter, target.id);
    await db
      .update(reports)
      .set({ status: "dismissed", handledAt: new Date() })
      .where(eq(reports.reporterId, reporter.id));
    expect(await report(reporter, target.id)).toEqual({
      error: t.quota.reportCooldown,
    });

    await db
      .update(reports)
      .set({ handledAt: new Date(Date.now() - 8 * DAY) })
      .where(eq(reports.reporterId, reporter.id));
    expect(await report(reporter, target.id)).toEqual({
      ok: t.report.submitted,
    });
  });

  test("超过每日举报额度后被拒", async () => {
    const reporter = await createUser();
    const max = QUOTAS.daily["report.create"].newbie;
    for (let i = 0; i < max; i++) {
      const target = await createUser();
      expect(await report(reporter, target.id)).toEqual({
        ok: t.report.submitted,
      });
    }
    const extra = await createUser();
    expect(await report(reporter, extra.id)).toEqual({
      error: fmt(t.quota.reportDaily, { max }),
    });
  });
});

describe("拉黑", () => {
  test("拉黑与解除拉黑，重复拉黑不报错", async () => {
    const user = await createUser();
    const target = await createUser();
    expect(await blockUser(user, target.id, t)).toEqual({ ok: true });
    expect(await blockUser(user, target.id, t)).toEqual({ ok: true });
    expect(
      await db
        .select()
        .from(blocks)
        .where(
          and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, target.id)),
        ),
    ).toHaveLength(1);

    expect(await unblockUser(user, target.id)).toEqual({ ok: true });
    expect(
      await db.select().from(blocks).where(eq(blocks.blockerId, user.id)),
    ).toHaveLength(0);
  });

  test("不能拉黑自己", async () => {
    const user = await createUser();
    expect(await blockUser(user, user.id, t)).toBeNull();
  });
});

describe("管理员处置", () => {
  test("隐藏需求、暂停用户，已注销账号不受影响", async () => {
    const admin = await createUser();
    const author = await createUser();
    const [need] = await db
      .insert(needs)
      .values({ userId: author.id, type: "need", title: "违规需求" })
      .returning();

    expect(
      await moderateContent(admin, {
        targetType: "need",
        targetId: need.id,
        action: "hide",
      }),
    ).toEqual({ ok: true });
    const [hidden] = await db.select().from(needs).where(eq(needs.id, need.id));
    expect(hidden.moderationStatus).toBe("hidden");

    await moderateContent(admin, {
      targetType: "user",
      targetId: author.id,
      action: "suspend",
    });
    const [suspended] = await db
      .select()
      .from(users)
      .where(eq(users.id, author.id));
    expect(suspended.status).toBe("suspended");

    const deleted = await createUser();
    await db
      .update(users)
      .set({ status: "deleted" })
      .where(eq(users.id, deleted.id));
    await moderateContent(admin, {
      targetType: "user",
      targetId: deleted.id,
      action: "restore",
    });
    const [stillDeleted] = await db
      .select()
      .from(users)
      .where(eq(users.id, deleted.id));
    expect(stillDeleted.status).toBe("deleted");
  });

  test("未知动作不落库", async () => {
    const admin = await createUser();
    expect(
      await moderateContent(admin, {
        targetType: "need",
        targetId: 1,
        action: "burn",
      }),
    ).toBeNull();
  });

  test("举报只能被处理一次", async () => {
    const admin = await createUser();
    const reporter = await createUser();
    const target = await createUser();
    await report(reporter, target.id);
    const [row] = await db
      .select()
      .from(reports)
      .where(eq(reports.reporterId, reporter.id));

    await resolveReport(admin, { reportId: row.id, decision: "resolved" });
    const [resolved] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, row.id));
    expect(resolved.status).toBe("resolved");
    expect(resolved.handledBy).toBe(admin.id);

    await resolveReport(admin, { reportId: row.id, decision: "dismissed" });
    const [unchanged] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, row.id));
    expect(unchanged.status).toBe("resolved");
  });
});
