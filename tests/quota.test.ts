import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  analyticsEvents,
  blocks,
  connections,
  joinRequests,
  needs,
  orgs,
  reports,
  users,
  type Need,
  type User,
} from "@/lib/db/schema";
import {
  checkQuota,
  dailyLimit,
  effectiveDailyLimit,
  getQuotaSummary,
  isRegularAccount,
  isStalePending,
  QUOTAS,
} from "@/lib/quota";
import { SERVER_DICTS } from "@/lib/i18n/dict";
import { fmt } from "@/lib/i18n/fmt";

const t = SERVER_DICTS.zh;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let userSeq = 0;

async function createUser(
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<User> {
  const seq = ++userSeq;
  const [user] = await db
    .insert(users)
    .values({
      loginEmail: `quota-${seq}@test.local`,
      nickname: `额度用户${seq}`,
      email: `quota-${seq}@test.local`,
      ...overrides,
    })
    .returning();
  return user;
}

async function createNeed(userId: number): Promise<Need> {
  const [need] = await db
    .insert(needs)
    .values({
      userId,
      type: "offer",
      title: "额度测试需求",
      expiresAt: new Date(Date.now() + 3 * DAY),
    })
    .returning();
  return need;
}

async function insertPending(needId: number, initiatorId: number) {
  await db.insert(connections).values({
    needId,
    initiatorId,
    initiatorContact: "email",
    status: "pending",
  });
}

async function insertPendingJoinRequest(userId: number, seq: number) {
  const owner = await createUser();
  const [org] = await db
    .insert(orgs)
    .values({
      name: `额度组织${userId}-${seq}`,
      ownerId: owner.id,
      inviteCode: `QUOTA${userId}X${seq}`,
    })
    .returning({ id: orgs.id });
  await db
    .insert(joinRequests)
    .values({ orgId: org.id, userId, via: "plaza" });
}

describe("isRegularAccount", () => {
  test("满 72 小时且名片齐才算常规账号", () => {
    const now = Date.now();
    const base = {
      id: 1,
      loginEmail: "a@test.local",
      nickname: "甲",
      bio: "介绍",
      tags: ["前端"],
      city: null,
      wechat: null,
      email: "a@test.local",
      contactPhone: null,
      weixinMp: null,
      weixinChannels: null,
      xiaohongshu: null,
      weibo: null,
      fieldVisibility: {},
      status: "active" as const,
      suspendedAt: null,
      deletedAt: null,
      createdAt: new Date(now - 73 * 60 * 60 * 1000),
    };
    expect(isRegularAccount(base, now)).toBe(true);
    expect(
      isRegularAccount({ ...base, createdAt: new Date(now) }, now),
    ).toBe(false);
    expect(isRegularAccount({ ...base, bio: "" }, now)).toBe(false);
  });
});

describe("checkQuota", () => {
  test("举手 pending 满 5 不能再举", async () => {
    const raiser = await createUser();
    for (let i = 0; i < QUOTAS.stock.pendingHands; i++) {
      const owner = await createUser();
      const need = await createNeed(owner.id);
      await insertPending(need.id, raiser.id);
    }
    const result = await checkQuota(raiser, "connection.create", t);
    expect(result).toEqual({
      ok: false,
      reason: "stock",
      message: fmt(t.quota.pendingStock, { max: QUOTAS.stock.pendingHands }),
    });
  });

  test("未处理举手达到承接上限时不能发布", async () => {
    const owner = await createUser();
    const need = await createNeed(owner.id);
    for (let i = 0; i < QUOTAS.stock.incomingPending; i++) {
      const raiser = await createUser();
      await insertPending(need.id, raiser.id);
    }
    const result = await checkQuota(owner, "need.publish", t);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("backlog");
  });

  test("待审批的组织申请占满时不能再申请", async () => {
    const applicant = await createUser();
    for (let i = 0; i < QUOTAS.stock.pendingJoinRequests; i++) {
      await insertPendingJoinRequest(applicant.id, i);
    }
    const result = await checkQuota(applicant, "org.join", t);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("stock");
  });
});

describe("每日举手计数只看举手时刻", () => {
  test("对方今天接受昨天的举手，不占举手方今天的额度", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id);
    await insertPending(need.id, raiser.id);
    const yesterday = new Date(Date.now() - DAY);
    // 举手发生在昨天，今天只是被对方处理了一下
    await db
      .update(connections)
      .set({ createdAt: yesterday, lastRaisedAt: yesterday, updatedAt: new Date() })
      .where(eq(connections.initiatorId, raiser.id));

    const summary = await getQuotaSummary(raiser);
    const raiseLine = summary.daily.find((l) => l.key === "connection.create");
    expect(raiseLine?.used).toBe(0);
  });
});

describe("赚回", () => {
  test("举手被接受，当日举手额度上浮", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id);
    await db.insert(connections).values({
      needId: need.id,
      initiatorId: raiser.id,
      initiatorContact: "email",
      status: "accepted",
      acceptedAt: new Date(),
    });
    const base = dailyLimit(raiser, "connection.create");
    const effective = await effectiveDailyLimit(raiser, "connection.create");
    expect(effective.base).toBe(base);
    expect(effective.limit).toBe(base + QUOTAS.earn.perAcceptedRaise);
  });

  test("加成不超过基础额度的一倍", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    for (let i = 0; i < 20; i++) {
      const need = await createNeed(owner.id);
      await db.insert(connections).values({
        needId: need.id,
        initiatorId: raiser.id,
        initiatorContact: "email",
        status: "accepted",
        acceptedAt: new Date(),
      });
    }
    const base = dailyLimit(raiser, "connection.create");
    const effective = await effectiveDailyLimit(raiser, "connection.create");
    expect(effective.limit).toBe(base * QUOTAS.earn.maxMultiplier);
  });
});

describe("惩罚阶梯", () => {
  // 惩罚阶梯只有在 enforce 模式才真正降额；默认 shadow 只观测。
  beforeEach(() => {
    process.env.QUOTA_P4_MODE = "enforce";
  });
  afterEach(() => {
    delete process.env.QUOTA_P4_MODE;
  });

  test("24 小时内被 3 个人拉黑，举手日额度降档", async () => {
    const target = await createUser();
    for (let i = 0; i < QUOTAS.penalty.blockCount; i++) {
      const blocker = await createUser();
      await db.insert(blocks).values({
        blockerId: blocker.id,
        blockedId: target.id,
        createdAt: new Date(Date.now() - i * HOUR),
      });
    }
    const effective = await effectiveDailyLimit(target, "connection.create");
    expect(effective.penalty).toBe("blocked");
    expect(effective.limit).toBe(QUOTAS.penalty.blockRaiseLimit);
  });

  test("拉黑分散在 7 天里、凑不满 24 小时窗口时不降档", async () => {
    const target = await createUser();
    for (let i = 0; i < QUOTAS.penalty.blockCount; i++) {
      const blocker = await createUser();
      await db.insert(blocks).values({
        blockerId: blocker.id,
        blockedId: target.id,
        createdAt: new Date(Date.now() - i * 2 * DAY),
      });
    }
    const effective = await effectiveDailyLimit(target, "connection.create");
    expect(effective.penalty).toBeNull();
  });

  test("24 小时内 3 条待处理举报，发布日额度降档", async () => {
    const target = await createUser();
    for (let i = 0; i < QUOTAS.penalty.reportCount; i++) {
      const reporter = await createUser();
      await db.insert(reports).values({
        reporterId: reporter.id,
        targetType: "user",
        targetId: target.id,
        reason: "spam",
      });
    }
    const effective = await effectiveDailyLimit(target, "need.publish");
    expect(effective.penalty).toBe("reported");
    expect(effective.limit).toBe(QUOTAS.penalty.reportPublishLimit);
  });

  test("举报处理完，降额自动解除", async () => {
    const target = await createUser();
    for (let i = 0; i < QUOTAS.penalty.reportCount; i++) {
      const reporter = await createUser();
      await db.insert(reports).values({
        reporterId: reporter.id,
        targetType: "user",
        targetId: target.id,
        reason: "spam",
        status: "dismissed",
        handledAt: new Date(),
      });
    }
    const effective = await effectiveDailyLimit(target, "need.publish");
    expect(effective.penalty).toBeNull();
  });
});

describe("P4 影子模式", () => {
  afterEach(() => {
    delete process.env.QUOTA_P4_MODE;
  });

  async function blockBurst(target: User) {
    for (let i = 0; i < QUOTAS.penalty.blockCount; i++) {
      const blocker = await createUser();
      await db.insert(blocks).values({
        blockerId: blocker.id,
        blockedId: target.id,
        createdAt: new Date(Date.now() - i * HOUR),
      });
    }
  }

  test("默认 shadow：不降低实际额度，惩罚只作为候选", async () => {
    delete process.env.QUOTA_P4_MODE;
    const target = await createUser();
    await blockBurst(target);
    const base = dailyLimit(target, "connection.create");
    const effective = await effectiveDailyLimit(target, "connection.create");
    expect(effective.penalty).toBeNull();
    expect(effective.limit).toBe(base);
    expect(effective.shadowPenalty).toBe("blocked");
    expect(effective.shadowLimit).toBe(QUOTAS.penalty.blockRaiseLimit);
  });

  test("enforce：同样的信号真正把额度降到惩罚上限", async () => {
    process.env.QUOTA_P4_MODE = "enforce";
    const target = await createUser();
    await blockBurst(target);
    const effective = await effectiveDailyLimit(target, "connection.create");
    expect(effective.penalty).toBe("blocked");
    expect(effective.limit).toBe(QUOTAS.penalty.blockRaiseLimit);
    expect(effective.shadowPenalty).toBeNull();
  });

  test("shadow 命中候选阈值时，同一天只写一条影子事件", async () => {
    delete process.env.QUOTA_P4_MODE;
    const target = await createUser();
    await blockBurst(target);
    // 今天已用满候选惩罚上限（撤回状态不占存量，只让 countRaisesToday 计数）
    for (let i = 0; i < QUOTAS.penalty.blockRaiseLimit; i++) {
      const owner = await createUser();
      const need = await createNeed(owner.id);
      await db.insert(connections).values({
        needId: need.id,
        initiatorId: target.id,
        initiatorContact: "email",
        status: "cancelled",
        lastRaisedAt: new Date(),
      });
    }

    await checkQuota(target, "connection.create", t);
    await checkQuota(target, "connection.create", t);

    const [row] = await db
      .select({ n: count() })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.name, "quota_penalty_shadow"),
          eq(analyticsEvents.userId, target.id),
        ),
      );
    expect(row?.n).toBe(1);
  });
});

describe("isStalePending", () => {
  test("挂满 72 小时的 pending 才算已无回应", () => {
    const now = Date.now();
    expect(isStalePending("pending", new Date(now - 71 * HOUR), now)).toBe(false);
    expect(isStalePending("pending", new Date(now - 73 * HOUR), now)).toBe(true);
    expect(isStalePending("accepted", new Date(now - 73 * HOUR), now)).toBe(false);
  });
});

describe("getQuotaSummary", () => {
  test("三条日额度与五项存量都在，未处理举手单独计数", async () => {
    const owner = await createUser();
    const need = await createNeed(owner.id);
    const raiser = await createUser();
    await insertPending(need.id, raiser.id);
    await db
      .update(connections)
      .set({ createdAt: new Date(Date.now() - 80 * HOUR) })
      .where(eq(connections.initiatorId, raiser.id));

    const summary = await getQuotaSummary(owner);
    expect(summary.daily.map((line) => line.key)).toEqual([
      "need.publish",
      "connection.create",
      "connection.accept",
    ]);
    expect(summary.stock).toHaveLength(5);
    expect(summary.stock.find((s) => s.key === "openNeeds")?.used).toBe(1);
    expect(summary.stock.find((s) => s.key === "incomingPending")?.used).toBe(1);
    expect(summary.staleIncoming).toBe(1);
  });
});
