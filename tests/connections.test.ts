import { describe, expect, test } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  connections,
  contactReveals,
  needs,
  orgMembers,
  orgs,
  users,
  type Need,
  type User,
} from "@/lib/db/schema";
import {
  cancelConnection,
  confirmConnectionCompleted,
  expressInterest,
  handleConnection,
  revealedFieldsTo,
} from "@/lib/connections-service";
import { deleteNeed } from "@/lib/needs-service";
import {
  getInitiatedConnections,
  getReceivedConnections,
} from "@/lib/queries";
import { isStalePending } from "@/lib/quota";
import { canSee } from "@/lib/card";
import { SERVER_DICTS } from "@/lib/i18n/dict";

const t = SERVER_DICTS.zh;
const DAY = 24 * 60 * 60 * 1000;

let userSeq = 0;

async function createUser(): Promise<User> {
  const seq = ++userSeq;
  const [user] = await db
    .insert(users)
    .values({
      loginEmail: `conn-${seq}@test.local`,
      nickname: `举手用户${seq}`,
      email: `conn-${seq}@test.local`,
    })
    .returning();
  return user;
}

async function createNeed(
  userId: number,
  overrides: Partial<typeof needs.$inferInsert> = {},
): Promise<Need> {
  const [need] = await db
    .insert(needs)
    .values({
      userId,
      type: "offer",
      title: "测试需求",
      expiresAt: new Date(Date.now() + 3 * DAY),
      ...overrides,
    })
    .returning();
  return need;
}

async function getConnection(needId: number, initiatorId: number) {
  const [row] = await db
    .select()
    .from(connections)
    .where(
      and(eq(connections.needId, needId), eq(connections.initiatorId, initiatorId)),
    )
    .limit(1);
  return row ?? null;
}

describe("expressInterest", () => {
  test("开放需求可举手，状态为 pending", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id);
    const result = await expressInterest(raiser, { needId: need.id, message: "我来" }, t);
    expect(result).toEqual({ ok: true });
    const row = await getConnection(need.id, raiser.id);
    expect(row?.status).toBe("pending");
    expect(row?.message).toBe("我来");
  });

  test("不能给自己的需求举手", async () => {
    const owner = await createUser();
    const need = await createNeed(owner.id);
    const result = await expressInterest(owner, { needId: need.id, message: "" }, t);
    expect(result).toEqual({ error: t.connection.notOpen });
  });

  test("pending 时不能重复举手", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id);
    await expressInterest(raiser, { needId: need.id, message: "" }, t);
    const again = await expressInterest(raiser, { needId: need.id, message: "再来" }, t);
    expect(again).toEqual({ error: t.connection.already });
  });

  test("组织需求：非成员举手当需求不存在", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const [org] = await db
      .insert(orgs)
      .values({
        name: "圈子",
        visibility: "private",
        ownerId: owner.id,
        inviteCode: `CONN${++userSeq}A`,
      })
      .returning();
    await db.insert(orgMembers).values({ orgId: org.id, userId: owner.id, role: "owner" });
    const need = await createNeed(owner.id, { orgId: org.id });
    const result = await expressInterest(outsider, { needId: need.id, message: "" }, t);
    expect(result).toEqual({ error: t.connection.needNotFound });
  });
});

describe("举手状态迁移", () => {
  test("拒绝后 7 天内不能再举手；冷却后可原地再举", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id);
    await expressInterest(raiser, { needId: need.id, message: "第一次" }, t);
    const row = await getConnection(need.id, raiser.id);
    expect(await handleConnection(owner, { connectionId: row!.id, decision: "reject" }, t)).toEqual({
      ok: true,
    });
    expect((await getConnection(need.id, raiser.id))?.status).toBe("rejected");
    expect(await expressInterest(raiser, { needId: need.id, message: "再试" }, t)).toEqual({
      error: t.connection.rejectCooldown,
    });

    await db
      .update(connections)
      .set({ updatedAt: new Date(Date.now() - 8 * DAY) })
      .where(eq(connections.id, row!.id));
    const again = await expressInterest(raiser, { needId: need.id, message: "再试" }, t);
    expect(again).toEqual({ ok: true });
    const reused = await getConnection(need.id, raiser.id);
    expect(reused?.id).toBe(row!.id);
    expect(reused?.status).toBe("pending");
    expect(reused?.message).toBe("再试");
  });

  test("撤回后可再举手；发布者不能撤回", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id);
    await expressInterest(raiser, { needId: need.id, message: "" }, t);
    const row = await getConnection(need.id, raiser.id);
    expect(await cancelConnection(owner, row!.id)).toBeNull();
    expect(await cancelConnection(raiser, row!.id)).toEqual({ ok: true });
    expect((await getConnection(need.id, raiser.id))?.status).toBe("cancelled");

    const again = await expressInterest(raiser, { needId: need.id, message: "" }, t);
    expect(again).toEqual({ ok: true });
    expect((await getConnection(need.id, raiser.id))?.status).toBe("pending");
  });

  test("接受后双方确认才 completed；单方确认仍是 accepted", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id);
    await expressInterest(raiser, { needId: need.id, message: "" }, t);
    const row = await getConnection(need.id, raiser.id);
    expect(await handleConnection(raiser, { connectionId: row!.id, decision: "accept" }, t)).toBeNull();
    expect(await handleConnection(owner, { connectionId: row!.id, decision: "accept" }, t)).toEqual({
      ok: true,
    });
    expect((await getConnection(need.id, raiser.id))?.status).toBe("accepted");

    const first = await confirmConnectionCompleted(owner, row!.id);
    expect(first).toEqual({ ok: true, completed: false });
    expect((await getConnection(need.id, raiser.id))?.status).toBe("accepted");

    const second = await confirmConnectionCompleted(raiser, row!.id);
    expect(second).toEqual({ ok: true, completed: true });
    expect((await getConnection(need.id, raiser.id))?.status).toBe("completed");
  });

  test("接受后写入双向揭示，且只给交换的那一项", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id, { preferredContact: "email" });
    await expressInterest(
      raiser,
      { needId: need.id, message: "", contact: "email" },
      t,
    );
    const row = await getConnection(need.id, raiser.id);
    expect(row?.initiatorContact).toBe("email");
    await handleConnection(owner, { connectionId: row!.id, decision: "accept" }, t);
    const toRaiser = await revealedFieldsTo(owner.id, raiser.id);
    const toOwner = await revealedFieldsTo(raiser.id, owner.id);
    expect([...toRaiser]).toEqual(["email"]);
    expect([...toOwner]).toEqual(["email"]);
    expect(
      canSee(owner.fieldVisibility, "email", {
        loggedIn: true,
        sharesOrg: false,
        revealedFields: toRaiser,
      }),
    ).toBe(true);
    expect(
      canSee(owner.fieldVisibility, "email", {
        loggedIn: true,
        sharesOrg: false,
      }),
    ).toBe(false);
  });
});

async function countReveals(needId: number) {
  const [row] = await db
    .select({ n: count() })
    .from(contactReveals)
    .where(eq(contactReveals.needId, needId));
  return row?.n ?? 0;
}

async function countConnections(needId: number) {
  const [row] = await db
    .select({ n: count() })
    .from(connections)
    .where(eq(connections.needId, needId));
  return row?.n ?? 0;
}

describe("并发与原子性", () => {
  test("同一举手方并发举手同一需求，只落一条 pending", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id, { preferredContact: "email" });
    const results = await Promise.all([
      expressInterest(raiser, { needId: need.id, message: "A" }, t),
      expressInterest(raiser, { needId: need.id, message: "B" }, t),
    ]);
    const oks = results.filter((r) => "ok" in r);
    const errs = results.filter((r) => "error" in r);
    expect(oks).toHaveLength(1);
    expect(errs).toEqual([{ error: t.connection.already }]);
    expect(await countConnections(need.id)).toBe(1);
  });

  test("发布者并发接受同一举手，只接受一次且恰好两条揭示", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id, { preferredContact: "email" });
    await expressInterest(raiser, { needId: need.id, message: "", contact: "email" }, t);
    const row = await getConnection(need.id, raiser.id);
    const results = await Promise.all([
      handleConnection(owner, { connectionId: row!.id, decision: "accept" }, t),
      handleConnection(owner, { connectionId: row!.id, decision: "accept" }, t),
    ]);
    const oks = results.filter((r) => r && "ok" in r);
    expect(oks).toHaveLength(1);
    expect(results).toContain(null);
    expect((await getConnection(need.id, raiser.id))?.status).toBe("accepted");
    // 揭示与接受同一事务：恰好两条，不会因重复接受写成四条
    expect(await countReveals(need.id)).toBe(2);
  });

  test("接受写入的两条揭示要么都在要么都不在", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id, { preferredContact: "email" });
    await expressInterest(raiser, { needId: need.id, message: "", contact: "email" }, t);
    const row = await getConnection(need.id, raiser.id);
    expect(await countReveals(need.id)).toBe(0);
    await handleConnection(owner, { connectionId: row!.id, decision: "accept" }, t);
    expect(await countReveals(need.id)).toBe(2);
  });

  test("删除需求级联清掉举手与揭示", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id, { preferredContact: "email" });
    await expressInterest(raiser, { needId: need.id, message: "", contact: "email" }, t);
    const row = await getConnection(need.id, raiser.id);
    await handleConnection(owner, { connectionId: row!.id, decision: "accept" }, t);
    expect(await countConnections(need.id)).toBe(1);
    expect(await countReveals(need.id)).toBe(2);

    await deleteNeed(need);
    expect(await countConnections(need.id)).toBe(0);
    expect(await countReveals(need.id)).toBe(0);
    const [gone] = await db.select().from(needs).where(eq(needs.id, need.id)).limit(1);
    expect(gone).toBeUndefined();
  });
});

describe("我的连接中心查询", () => {
  test("收到与发起互相隔离，只返回本人相关的连接", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const otherOwner = await createUser();
    const ownerNeed = await createNeed(owner.id, { preferredContact: "email" });
    const otherNeed = await createNeed(otherOwner.id, { preferredContact: "email" });
    await expressInterest(raiser, { needId: ownerNeed.id, message: "对你" }, t);
    await expressInterest(owner, { needId: otherNeed.id, message: "对别人" }, t);

    const received = await getReceivedConnections(owner.id);
    expect(received).toHaveLength(1);
    expect(received[0]?.needId).toBe(ownerNeed.id);
    expect(received[0]?.otherId).toBe(raiser.id);

    const initiated = await getInitiatedConnections(owner.id);
    expect(initiated).toHaveLength(1);
    expect(initiated[0]?.needId).toBe(otherNeed.id);
    expect(initiated[0]?.otherId).toBe(otherOwner.id);
  });

  test("待处理项置顶，即使已接受的更新更晚", async () => {
    const owner = await createUser();
    const raiserPending = await createUser();
    const raiserAccepted = await createUser();
    const needPending = await createNeed(owner.id, { preferredContact: "email" });
    const needAccepted = await createNeed(owner.id, { preferredContact: "email" });
    // 先落 pending，再落一个更晚被接受的连接
    await expressInterest(raiserPending, { needId: needPending.id, message: "" }, t);
    await expressInterest(
      raiserAccepted,
      { needId: needAccepted.id, message: "", contact: "email" },
      t,
    );
    const acc = await getConnection(needAccepted.id, raiserAccepted.id);
    await handleConnection(owner, { connectionId: acc!.id, decision: "accept" }, t);

    const received = await getReceivedConnections(owner.id);
    expect(received).toHaveLength(2);
    expect(received[0]?.status).toBe("pending");
    expect(received[0]?.needId).toBe(needPending.id);
  });

  test("pending 挂满 72 小时判为 stale", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id, { preferredContact: "email" });
    await expressInterest(raiser, { needId: need.id, message: "" }, t);
    const row = await getConnection(need.id, raiser.id);
    await db
      .update(connections)
      .set({ createdAt: new Date(Date.now() - 4 * DAY) })
      .where(eq(connections.id, row!.id));

    const received = await getReceivedConnections(owner.id);
    expect(received[0]?.status).toBe("pending");
    expect(isStalePending(received[0]!.status, received[0]!.createdAt)).toBe(true);
  });

  test("接受后收到与发起两侧状态同步为 accepted", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id, { preferredContact: "email" });
    await expressInterest(raiser, { needId: need.id, message: "", contact: "email" }, t);
    const row = await getConnection(need.id, raiser.id);
    await handleConnection(owner, { connectionId: row!.id, decision: "accept" }, t);

    const received = await getReceivedConnections(owner.id);
    const initiated = await getInitiatedConnections(raiser.id);
    expect(received[0]?.status).toBe("accepted");
    expect(initiated[0]?.status).toBe("accepted");
  });
});
