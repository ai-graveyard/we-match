import { describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { connections, needs, users, type Need } from "@/lib/db/schema";
import {
  applyNeedPatch,
  hasStaleIncomingHands,
  isLifeExtension,
  STALE_HAND_LOCK_HOURS,
} from "@/lib/needs-service";
import { SERVER_DICTS } from "@/lib/i18n/dict";

// 续期锁（QUOTA.md 第 6 节配套规则 / AGENT-FIRST.md 7.3）：
// 存在超过 72 小时未处理的举手时，发布者不能续期或重开任何需求

const t = SERVER_DICTS.zh;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let userSeq = 0;

async function createUser() {
  const seq = ++userSeq;
  const [user] = await db
    .insert(users)
    .values({ loginEmail: `renewal-lock-${seq}@test.local`, nickname: `用户${seq}` })
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

async function raiseHand(
  needId: number,
  initiatorId: number,
  {
    ageHours,
    status = "pending",
  }: { ageHours: number; status?: "pending" | "accepted" | "rejected" },
) {
  await db.insert(connections).values({
    needId,
    initiatorId,
    status,
    createdAt: new Date(Date.now() - ageHours * HOUR),
  });
}

const STALE = STALE_HAND_LOCK_HOURS + 1;
const FRESH = STALE_HAND_LOCK_HOURS - 1;

function renewPatch() {
  return { expiresAt: new Date(Date.now() + 30 * DAY) };
}

describe("hasStaleIncomingHands", () => {
  test("无举手时为 false", async () => {
    const owner = await createUser();
    expect(await hasStaleIncomingHands(owner.id)).toBe(false);
  });

  test("超时 pending 举手为 true；已处理或未超时不算", async () => {
    const owner = await createUser();
    const need = await createNeed(owner.id);
    const [a, b, c] = await Promise.all([createUser(), createUser(), createUser()]);
    await raiseHand(need.id, a.id, { ageHours: FRESH });
    await raiseHand(need.id, b.id, { ageHours: STALE, status: "rejected" });
    expect(await hasStaleIncomingHands(owner.id)).toBe(false);
    await raiseHand(need.id, c.id, { ageHours: STALE });
    expect(await hasStaleIncomingHands(owner.id)).toBe(true);
  });

  test("按发布者隔离：别人的超时举手不影响我", async () => {
    const owner = await createUser();
    const other = await createUser();
    const raiser = await createUser();
    const othersNeed = await createNeed(other.id);
    await raiseHand(othersNeed.id, raiser.id, { ageHours: STALE });
    expect(await hasStaleIncomingHands(owner.id)).toBe(false);
    expect(await hasStaleIncomingHands(other.id)).toBe(true);
  });
});

describe("isLifeExtension", () => {
  test("延长截止 / 改永久 / 重开算续命", async () => {
    const owner = await createUser();
    const need = await createNeed(owner.id);
    expect(isLifeExtension(need, renewPatch())).toBe(true);
    expect(isLifeExtension(need, { expiresAt: null })).toBe(true);
    const closed = await createNeed(owner.id, { status: "closed" });
    expect(isLifeExtension(closed, { status: "open" })).toBe(true);
  });

  test("缩短截止 / 关闭 / 只改内容不算续命", async () => {
    const owner = await createUser();
    const need = await createNeed(owner.id);
    expect(isLifeExtension(need, { expiresAt: new Date(Date.now() + DAY) })).toBe(false);
    expect(isLifeExtension(need, { status: "closed" })).toBe(false);
    expect(isLifeExtension(need, { title: "改个标题" })).toBe(false);
    // 永久帖设一个具体截止时间是收紧，不是续命
    const permanent = await createNeed(owner.id, { expiresAt: null });
    expect(isLifeExtension(permanent, { expiresAt: new Date(Date.now() + DAY) })).toBe(false);
  });
});

describe("applyNeedPatch 续期锁", () => {
  test("无超时举手：续期正常", async () => {
    const owner = await createUser();
    const need = await createNeed(owner.id);
    const applied = await applyNeedPatch(need, renewPatch(), t);
    expect("need" in applied && applied.need.expiresAt).toBeTruthy();
  });

  test("有超时举手：续期被拒，返回撞墙文案", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id);
    await raiseHand(need.id, raiser.id, { ageHours: STALE });
    const applied = await applyNeedPatch(need, renewPatch(), t);
    expect(applied).toEqual({ error: t.need.staleHandsBlockRenewal });
  });

  test("有超时举手：重开也被拒，且锁跨越该用户所有需求", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const handedNeed = await createNeed(owner.id);
    const closedNeed = await createNeed(owner.id, { status: "closed" });
    await raiseHand(handedNeed.id, raiser.id, { ageHours: STALE });
    const applied = await applyNeedPatch(closedNeed, { status: "open" }, t);
    expect(applied).toEqual({ error: t.need.staleHandsBlockRenewal });
  });

  test("有超时举手：改内容、关闭、缩短截止仍放行", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id);
    await raiseHand(need.id, raiser.id, { ageHours: STALE });
    const edited = await applyNeedPatch(need, { title: "只改标题" }, t);
    expect("need" in edited && edited.need.title).toBe("只改标题");
    const shortened = await applyNeedPatch(
      need,
      { expiresAt: new Date(Date.now() + DAY) },
      t,
    );
    expect("need" in shortened).toBe(true);
    const closed = await applyNeedPatch(need, { status: "closed" }, t);
    expect("need" in closed && closed.need.status).toBe("closed");
  });

  test("超时举手处理掉之后，续期立刻恢复", async () => {
    const owner = await createUser();
    const raiser = await createUser();
    const need = await createNeed(owner.id);
    await raiseHand(need.id, raiser.id, { ageHours: STALE });
    expect("error" in (await applyNeedPatch(need, renewPatch(), t))).toBe(true);
    await db
      .update(connections)
      .set({ status: "rejected" })
      .where(eq(connections.needId, need.id));
    const applied = await applyNeedPatch(need, renewPatch(), t);
    expect("need" in applied).toBe(true);
  });
});
