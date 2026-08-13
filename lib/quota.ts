import "server-only";
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  or,
} from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blocks,
  connections,
  contactReveals,
  joinRequests,
  needs,
  orgs,
  reports,
  type User,
} from "@/lib/db/schema";
import { CONTACT_FIELDS } from "@/lib/card";
import { consumeRateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/activity";
import { fmt } from "@/lib/i18n/fmt";
import type { ServerDict } from "@/lib/i18n/dict/types";

// 额度与反滥用：网页 Action 与开放 API 共用。数值按 QUOTA.md 保守值写死。

export type QuotaKey =
  | "need.publish"
  | "connection.create"
  | "connection.accept"
  | "report.create"
  | "block.create"
  | "org.create"
  | "org.join";

export type QuotaDenial = {
  ok: false;
  reason: "throttle" | "daily" | "stock" | "target" | "penalty" | "backlog";
  message: string;
};

export const QUOTAS = {
  newAccountHours: 72,
  pendingFreshHours: 72,
  // 没列进来的动作不做秒级节流，只受日额度与「任意写操作」兜底约束
  throttle: {
    "need.publish": { windowMs: 30_000, limit: 1 },
    "connection.create": { windowMs: 20_000, limit: 1 },
    "connection.accept": { windowMs: 10_000, limit: 1 },
    "report.create": { windowMs: 60_000, limit: 1 },
    "org.join": { windowMs: 60_000, limit: 1 },
  },
  daily: {
    "need.publish": { newbie: 3, regular: 10 },
    "connection.create": { newbie: 3, regular: 8 },
    "connection.accept": { newbie: 5, regular: 20 },
    "report.create": { newbie: 3, regular: 10 },
    "block.create": { newbie: 20, regular: 50 },
    "org.create": { newbie: 1, regular: 2 },
    "org.join": { newbie: 2, regular: 5 },
  },
  stock: {
    openNeeds: 20,
    pendingHands: 5,
    acceptedOpen: 10,
    incomingPending: 10,
    pendingJoinRequests: 3,
  },
  target: {
    sameUserPerDay: 2,
    rejectCooldownDays: 7,
    cancelResendMax: 3,
    acceptPerNeed: 10,
    dailyRevealsAsProvider: 30,
  },
  // 赚回：行为质量换额度，单日加成不超过基础额度的 1 倍（QUOTA.md 第 9 节）
  earn: {
    perAcceptedRaise: 2,
    completedPublish: 2,
    completedRaise: 3,
    promptHandleHours: 24,
    perPromptHandle: 1,
    maxMultiplier: 2,
  },
  // 惩罚阶梯：滥用信号累积后降额而不封号（QUOTA.md 第 10 节）
  penalty: {
    harvestWindowDays: 7,
    harvestAccepts: 30,
    harvestRate: 0.9,
    harvestAcceptLimit: 3,
    needHarvestRaises: 30,
    needHarvestRate: 0.8,
    blockWindowHours: 24,
    blockCount: 3,
    blockPenaltyDays: 7,
    blockRaiseLimit: 3,
    reportWindowHours: 24,
    reportCount: 3,
    reportPublishLimit: 2,
    lowRateSample: 20,
    lowRate: 0.05,
    lowRateRaiseLimit: 5,
  },
  reportCooldownDays: 7,
} as const;

type ThrottleSpec = { windowMs: number; limit: number };
const THROTTLES: Partial<Record<QuotaKey, ThrottleSpec>> = QUOTAS.throttle;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function dayStart(now = Date.now()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function isRegularAccount(user: User, now = Date.now()): boolean {
  if (now - user.createdAt.getTime() < QUOTAS.newAccountHours * HOUR) {
    return false;
  }
  const hasContact = CONTACT_FIELDS.some((field) => !!user[field.key]);
  return !!(user.bio?.trim() && user.tags.length > 0 && hasContact);
}

/** 基础日额度，只看账号分档。实际可用额度走 effectiveDailyLimit */
export function dailyLimit(user: User, key: QuotaKey, now = Date.now()): number {
  const tier = isRegularAccount(user, now) ? "regular" : "newbie";
  return QUOTAS.daily[key][tier];
}

export type QuotaPenalty =
  | "harvest"
  | "blocked"
  | "low-accept-rate"
  | "reported";

export type P4Mode = "shadow" | "enforce";

/**
 * P4 惩罚阶梯的开关。默认 `shadow`：只观测不降额，避免误伤把真实用户挡在外面。
 * 确认阈值稳妥后由运营把 `QUOTA_P4_MODE` 设为 `enforce` 才真正降额。
 */
export function quotaP4Mode(): P4Mode {
  return process.env.QUOTA_P4_MODE === "enforce" ? "enforce" : "shadow";
}

export type EffectiveLimit = {
  base: number;
  limit: number;
  earned: number;
  // 已执行的降额：enforce 模式下命中惩罚时非空。UI 与拦截文案只认这个字段。
  penalty: QuotaPenalty | null;
  // 候选降额：shadow 模式下「若 enforce 会命中」的惩罚与其会压到的上限。
  // 只用于观测和写影子事件，不改变用户实际可用额度。
  shadowPenalty: QuotaPenalty | null;
  shadowLimit: number | null;
};

/**
 * 实际日额度 = 基础额度 + 赚回加成，再被惩罚阶梯一票压低。
 * 惩罚优先于赚回：降额是为了止损，不该被「做得多」抵消。
 * shadow 模式下惩罚只作为候选记录，不压低实际额度。
 */
export async function effectiveDailyLimit(
  user: User,
  key: QuotaKey,
  now = Date.now(),
): Promise<EffectiveLimit> {
  const base = dailyLimit(user, key, now);
  const [earned, penalized] = await Promise.all([
    earnedBonus(user.id, key, now),
    penaltyFor(user.id, key, now),
  ]);
  const withEarn = Math.min(base + earned, base * QUOTAS.earn.maxMultiplier);
  if (penalized) {
    if (quotaP4Mode() === "enforce") {
      return {
        base,
        limit: penalized.limit,
        earned,
        penalty: penalized.penalty,
        shadowPenalty: null,
        shadowLimit: null,
      };
    }
    return {
      base,
      limit: withEarn,
      earned,
      penalty: null,
      shadowPenalty: penalized.penalty,
      shadowLimit: penalized.limit,
    };
  }
  return {
    base,
    limit: withEarn,
    earned,
    penalty: null,
    shadowPenalty: null,
    shadowLimit: null,
  };
}

/**
 * shadow 模式下，当用户已经达到「若 enforce 就会被拦截」的量时，写一条限频的
 * 分析事件供管理端观察。同一用户 / 动作 / 天只记一次，避免刷屏。
 */
async function recordShadowPenalty(
  userId: number,
  key: QuotaKey,
  effective: EffectiveLimit,
  used: number,
): Promise<void> {
  if (
    effective.shadowPenalty == null ||
    effective.shadowLimit == null ||
    used < effective.shadowLimit
  ) {
    return;
  }
  const fresh = await consumeRateLimit(
    `quota-shadow:${key}:${userId}`,
    1,
    DAY,
  );
  if (!fresh) return;
  await track({
    name: "quota_penalty_shadow",
    userId,
    metadata: {
      key,
      penalty: effective.shadowPenalty,
      shadowLimit: effective.shadowLimit,
      used,
    },
  });
}

// 赚回只覆盖发布 / 举手 / 接受三条主链路，安全类动作不参与
async function earnedBonus(
  userId: number,
  key: QuotaKey,
  now: number,
): Promise<number> {
  if (
    key !== "need.publish" &&
    key !== "connection.create" &&
    key !== "connection.accept"
  ) {
    return 0;
  }
  const today = dayStart(now);
  const yesterday = new Date(today.getTime() - DAY);

  if (key === "connection.create") {
    const [accepted, completed] = await Promise.all([
      countMyRaisesAcceptedSince(userId, today),
      countCompletedBetween(userId, yesterday, today),
    ]);
    return (
      accepted * QUOTAS.earn.perAcceptedRaise +
      completed * QUOTAS.earn.completedRaise
    );
  }
  if (key === "need.publish") {
    const completed = await countCompletedBetween(userId, yesterday, today);
    return completed * QUOTAS.earn.completedPublish;
  }
  // 奖励处理速度而不是接受本身：接受和拒绝都算，否则等于补贴收割
  const prompt = await countPromptHandlesSince(userId, today);
  return prompt * QUOTAS.earn.perPromptHandle;
}

async function penaltyFor(
  userId: number,
  key: QuotaKey,
  now: number,
): Promise<{ limit: number; penalty: QuotaPenalty } | null> {
  if (key === "connection.accept") {
    const stats = await acceptStatsSince(
      userId,
      new Date(now - QUOTAS.penalty.harvestWindowDays * DAY),
    );
    if (
      stats.accepted > QUOTAS.penalty.harvestAccepts &&
      stats.handled > 0 &&
      stats.accepted / stats.handled > QUOTAS.penalty.harvestRate
    ) {
      return { limit: QUOTAS.penalty.harvestAcceptLimit, penalty: "harvest" };
    }
    return null;
  }

  if (key === "connection.create") {
    if (await recentlyBlockedBurst(userId, now)) {
      return { limit: QUOTAS.penalty.blockRaiseLimit, penalty: "blocked" };
    }
    const stats = await myRaiseOutcomes(userId);
    if (
      stats.resolved >= QUOTAS.penalty.lowRateSample &&
      stats.accepted / stats.resolved < QUOTAS.penalty.lowRate
    ) {
      return {
        limit: QUOTAS.penalty.lowRateRaiseLimit,
        penalty: "low-accept-rate",
      };
    }
    return null;
  }

  if (key !== "need.publish") return null;
  if (await pendingReportBurst(userId, now)) {
    return { limit: QUOTAS.penalty.reportPublishLimit, penalty: "reported" };
  }
  return null;
}

/**
 * 「24 小时内被 N 个不同用户拉黑 → 降额 M 天」不落新表：
 * 取惩罚期内的拉黑时刻，滑动窗口里凑够 N 条即判定成立。
 */
function hasBurst(timestamps: number[], windowMs: number, threshold: number) {
  const sorted = [...timestamps].sort((a, b) => a - b);
  for (let i = threshold - 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - threshold + 1] <= windowMs) return true;
  }
  return false;
}

async function recentlyBlockedBurst(userId: number, now: number) {
  const since = new Date(now - QUOTAS.penalty.blockPenaltyDays * DAY);
  const rows = await db
    .select({ createdAt: blocks.createdAt })
    .from(blocks)
    .where(and(eq(blocks.blockedId, userId), gte(blocks.createdAt, since)));
  return hasBurst(
    rows.map((row) => row.createdAt.getTime()),
    QUOTAS.penalty.blockWindowHours * HOUR,
    QUOTAS.penalty.blockCount,
  );
}

// 「至处理完」：只看仍处于 pending 的举报，管理员处理掉即自动解除降额
async function pendingReportBurst(userId: number, now: number) {
  const rows = await db
    .select({ createdAt: reports.createdAt, reporterId: reports.reporterId })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, "user"),
        eq(reports.targetId, userId),
        eq(reports.status, "pending"),
      ),
    );
  const byReporter = new Map<number, number>();
  for (const row of rows) {
    if (row.reporterId == null) continue;
    const at = row.createdAt.getTime();
    if (at > now) continue;
    const seen = byReporter.get(row.reporterId);
    if (seen == null || at < seen) byReporter.set(row.reporterId, at);
  }
  return hasBurst(
    [...byReporter.values()],
    QUOTAS.penalty.reportWindowHours * HOUR,
    QUOTAS.penalty.reportCount,
  );
}

function throttleKey(userId: number, key: QuotaKey) {
  return `quota:${key}:${userId}`;
}

async function denyIfThrottled(
  userId: number,
  key: QuotaKey,
  t: ServerDict,
): Promise<QuotaDenial | null> {
  if (process.env.VITEST) return null;
  const spec = THROTTLES[key];
  if (!spec) return null;
  if (
    !(await consumeRateLimit(throttleKey(userId, key), spec.limit, spec.windowMs))
  ) {
    return { ok: false, reason: "throttle", message: t.quota.tooFast };
  }
  return null;
}

export async function checkQuota(
  user: User,
  key: QuotaKey,
  t: ServerDict,
  target: {
    userId?: number;
    needId?: number;
    targetType?: "user" | "need";
  } = {},
  now = Date.now(),
): Promise<{ ok: true; remaining: number } | QuotaDenial> {
  const throttled = await denyIfThrottled(user.id, key, t);
  if (throttled) return throttled;

  if (key === "need.publish") return checkPublish(user, t, now);
  if (key === "connection.create") {
    return checkCreateConnection(user, t, target, now);
  }
  if (key === "connection.accept") {
    return checkAcceptConnection(user, t, target, now);
  }
  if (key === "report.create") return checkReport(user, t, target, now);
  if (key === "org.join") return checkOrgJoin(user, t, now);
  return checkSimpleDaily(user, key, t, now);
}

// 举报、拉黑、建组织：只有日额度这一层，计数直接数实体表
async function checkSimpleDaily(
  user: User,
  key: QuotaKey,
  t: ServerDict,
  now: number,
): Promise<{ ok: true; remaining: number } | QuotaDenial> {
  const used = await countActionsToday(user.id, key, now);
  const { limit: max } = await effectiveDailyLimit(user, key, now);
  if (used >= max) {
    return { ok: false, reason: "daily", message: dailyDenial(t, key, max) };
  }
  return { ok: true, remaining: max - used };
}

function dailyDenial(t: ServerDict, key: QuotaKey, max: number) {
  if (key === "report.create") return fmt(t.quota.reportDaily, { max });
  if (key === "block.create") return fmt(t.quota.blockDaily, { max });
  if (key === "org.create") return fmt(t.quota.orgCreateDaily, { max });
  return fmt(t.quota.orgJoinDaily, { max });
}

async function checkReport(
  user: User,
  t: ServerDict,
  target: { userId?: number; needId?: number; targetType?: "user" | "need" },
  now: number,
): Promise<{ ok: true; remaining: number } | QuotaDenial> {
  const targetType = target.targetType;
  const targetId = targetType === "need" ? target.needId : target.userId;
  if (targetType && targetId != null) {
    const [last] = await db
      .select({ handledAt: reports.handledAt })
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, user.id),
          eq(reports.targetType, targetType),
          eq(reports.targetId, targetId),
          inArray(reports.status, ["resolved", "dismissed"]),
        ),
      )
      .orderBy(desc(reports.handledAt))
      .limit(1);
    const handledAt = last?.handledAt;
    if (
      handledAt &&
      now - handledAt.getTime() < QUOTAS.reportCooldownDays * DAY
    ) {
      return { ok: false, reason: "target", message: t.quota.reportCooldown };
    }
  }
  return checkSimpleDaily(user, "report.create", t, now);
}

async function checkOrgJoin(
  user: User,
  t: ServerDict,
  now: number,
): Promise<{ ok: true; remaining: number } | QuotaDenial> {
  const pending = await countPendingJoinRequests(user.id);
  if (pending >= QUOTAS.stock.pendingJoinRequests) {
    return {
      ok: false,
      reason: "stock",
      message: fmt(t.quota.orgJoinStock, {
        max: QUOTAS.stock.pendingJoinRequests,
      }),
    };
  }
  return checkSimpleDaily(user, "org.join", t, now);
}

async function countActionsToday(userId: number, key: QuotaKey, now: number) {
  const since = dayStart(now);
  if (key === "report.create") {
    const [row] = await db
      .select({ n: count() })
      .from(reports)
      .where(
        and(eq(reports.reporterId, userId), gte(reports.createdAt, since)),
      );
    return row?.n ?? 0;
  }
  if (key === "block.create") {
    const [row] = await db
      .select({ n: count() })
      .from(blocks)
      .where(and(eq(blocks.blockerId, userId), gte(blocks.createdAt, since)));
    return row?.n ?? 0;
  }
  if (key === "org.create") {
    const [row] = await db
      .select({ n: count() })
      .from(orgs)
      .where(and(eq(orgs.ownerId, userId), gte(orgs.createdAt, since)));
    return row?.n ?? 0;
  }
  const [row] = await db
    .select({ n: count() })
    .from(joinRequests)
    .where(
      and(eq(joinRequests.userId, userId), gte(joinRequests.createdAt, since)),
    );
  return row?.n ?? 0;
}

async function checkPublish(
  user: User,
  t: ServerDict,
  now: number,
): Promise<{ ok: true; remaining: number } | QuotaDenial> {
  const incoming = await countIncomingPending(user.id);
  if (incoming >= QUOTAS.stock.incomingPending) {
    return {
      ok: false,
      reason: "backlog",
      message: fmt(t.quota.publishBacklog, { n: incoming }),
    };
  }

  const open = await countOpenNeeds(user.id, now);
  if (open >= QUOTAS.stock.openNeeds) {
    return {
      ok: false,
      reason: "stock",
      message: fmt(t.quota.publishStock, { max: QUOTAS.stock.openNeeds }),
    };
  }

  const used = await countNeedsToday(user.id, now);
  const effective = await effectiveDailyLimit(user, "need.publish", now);
  const { limit: max, penalty } = effective;
  await recordShadowPenalty(user.id, "need.publish", effective, used);
  if (used >= max) {
    if (penalty) {
      return { ok: false, reason: "penalty", message: t.quota.penaltyPublish };
    }
    return {
      ok: false,
      reason: "daily",
      message: isRegularAccount(user, now)
        ? fmt(t.quota.publishDaily, { max })
        : fmt(t.quota.publishDailyNewbie, { max, full: QUOTAS.daily["need.publish"].regular }),
    };
  }
  return { ok: true, remaining: max - used };
}

async function checkCreateConnection(
  user: User,
  t: ServerDict,
  target: { userId?: number; needId?: number },
  now: number,
): Promise<{ ok: true; remaining: number } | QuotaDenial> {
  const pending = await countFreshPendingHands(user.id, now);
  if (pending >= QUOTAS.stock.pendingHands) {
    return {
      ok: false,
      reason: "stock",
      message: fmt(t.quota.pendingStock, { max: QUOTAS.stock.pendingHands }),
    };
  }

  const accepted = await countAcceptedOpen(user.id);
  if (accepted >= QUOTAS.stock.acceptedOpen) {
    return {
      ok: false,
      reason: "stock",
      message: fmt(t.quota.acceptedStock, { max: QUOTAS.stock.acceptedOpen }),
    };
  }

  if (target.needId != null) {
    if ((await countNeedAccepts(target.needId)) >= QUOTAS.target.acceptPerNeed) {
      return { ok: false, reason: "target", message: t.quota.needAcceptCap };
    }
    if (await isHarvestingNeed(target.needId)) {
      return { ok: false, reason: "penalty", message: t.quota.needClosedToRaises };
    }
  }

  if (target.userId != null) {
    const usedOnTarget = await countRaisesToUserToday(user.id, target.userId, now);
    if (usedOnTarget >= QUOTAS.target.sameUserPerDay) {
      return { ok: false, reason: "target", message: t.quota.sameUserDaily };
    }
  }

  const used = await countRaisesToday(user.id, now);
  const effective = await effectiveDailyLimit(user, "connection.create", now);
  const { limit: max, penalty } = effective;
  await recordShadowPenalty(user.id, "connection.create", effective, used);
  if (used >= max) {
    return {
      ok: false,
      reason: penalty ? "penalty" : "daily",
      message: penalty
        ? t.quota.penaltyRaise
        : fmt(t.quota.raiseDaily, { max }),
    };
  }
  return { ok: true, remaining: max - used };
}

async function checkAcceptConnection(
  user: User,
  t: ServerDict,
  target: { needId?: number },
  now: number,
): Promise<{ ok: true; remaining: number } | QuotaDenial> {
  if (target.needId != null) {
    if ((await countNeedAccepts(target.needId)) >= QUOTAS.target.acceptPerNeed) {
      return { ok: false, reason: "target", message: t.quota.needAcceptCap };
    }
  }

  const revealed = await countRevealsAsProviderToday(user.id, now);
  if (revealed >= QUOTAS.target.dailyRevealsAsProvider) {
    return {
      ok: false,
      reason: "daily",
      message: fmt(t.quota.revealDaily, { max: QUOTAS.target.dailyRevealsAsProvider }),
    };
  }

  const used = await countAcceptsToday(user.id, now);
  const effective = await effectiveDailyLimit(user, "connection.accept", now);
  const { limit: max, penalty } = effective;
  await recordShadowPenalty(user.id, "connection.accept", effective, used);
  if (used >= max) {
    return {
      ok: false,
      reason: penalty ? "penalty" : "daily",
      message: penalty
        ? t.quota.penaltyAccept
        : fmt(t.quota.acceptDaily, { max }),
    };
  }
  return { ok: true, remaining: max - used };
}

export async function countOpenNeeds(userId: number, now = Date.now()) {
  const [row] = await db
    .select({ n: count() })
    .from(needs)
    .where(
      and(
        eq(needs.userId, userId),
        eq(needs.status, "open"),
        or(isNull(needs.expiresAt), gt(needs.expiresAt, new Date(now))),
      ),
    );
  return row?.n ?? 0;
}

export async function countIncomingPending(userId: number) {
  const [row] = await db
    .select({ n: count() })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .where(and(eq(needs.userId, userId), eq(connections.status, "pending")));
  return row?.n ?? 0;
}

export async function countFreshPendingHands(userId: number, now = Date.now()) {
  const cutoff = new Date(now - QUOTAS.pendingFreshHours * HOUR);
  const [row] = await db
    .select({ n: count() })
    .from(connections)
    .where(
      and(
        eq(connections.initiatorId, userId),
        eq(connections.status, "pending"),
        gte(connections.createdAt, cutoff),
      ),
    );
  return row?.n ?? 0;
}

async function countNeedAccepts(needId: number) {
  const [row] = await db
    .select({ n: count() })
    .from(connections)
    .where(
      and(
        eq(connections.needId, needId),
        inArray(connections.status, ["accepted", "completed"]),
      ),
    );
  return row?.n ?? 0;
}

async function countAcceptedOpen(userId: number) {
  const [asInitiator] = await db
    .select({ n: count() })
    .from(connections)
    .where(
      and(eq(connections.initiatorId, userId), eq(connections.status, "accepted")),
    );
  const [asOwner] = await db
    .select({ n: count() })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .where(and(eq(needs.userId, userId), eq(connections.status, "accepted")));
  return (asInitiator?.n ?? 0) + (asOwner?.n ?? 0);
}

async function countNeedsToday(userId: number, now: number) {
  const [row] = await db
    .select({ n: count() })
    .from(needs)
    .where(and(eq(needs.userId, userId), gte(needs.createdAt, dayStart(now))));
  return row?.n ?? 0;
}

async function countRaisesToday(userId: number, now: number) {
  const [row] = await db
    .select({ n: count() })
    .from(connections)
    .where(
      and(
        eq(connections.initiatorId, userId),
        gte(connections.lastRaisedAt, dayStart(now)),
      ),
    );
  return row?.n ?? 0;
}

async function countRaisesToUserToday(
  initiatorId: number,
  targetUserId: number,
  now: number,
) {
  const [row] = await db
    .select({ n: count() })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .where(
      and(
        eq(connections.initiatorId, initiatorId),
        eq(needs.userId, targetUserId),
        gte(connections.lastRaisedAt, dayStart(now)),
      ),
    );
  return row?.n ?? 0;
}

async function countAcceptsToday(userId: number, now: number) {
  const [row] = await db
    .select({ n: count() })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .where(
      and(
        eq(needs.userId, userId),
        inArray(connections.status, ["accepted", "completed"]),
        gte(connections.acceptedAt, dayStart(now)),
      ),
    );
  return row?.n ?? 0;
}

async function countRevealsAsProviderToday(userId: number, now: number) {
  const [row] = await db
    .select({ n: count() })
    .from(contactReveals)
    .where(
      and(
        eq(contactReveals.fromUserId, userId),
        gte(contactReveals.createdAt, dayStart(now)),
      ),
    );
  return row?.n ?? 0;
}

export async function countStaleIncomingPending(
  userId: number,
  now = Date.now(),
) {
  const cutoff = new Date(now - QUOTAS.pendingFreshHours * HOUR);
  const [row] = await db
    .select({ n: count() })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .where(
      and(
        eq(needs.userId, userId),
        eq(connections.status, "pending"),
        lt(connections.createdAt, cutoff),
      ),
    );
  return row?.n ?? 0;
}

export async function countPendingJoinRequests(userId: number) {
  const [row] = await db
    .select({ n: count() })
    .from(joinRequests)
    .where(
      and(eq(joinRequests.userId, userId), eq(joinRequests.status, "pending")),
    );
  return row?.n ?? 0;
}

// 赚回：我发出的举手今天被接受了几个
async function countMyRaisesAcceptedSince(userId: number, since: Date) {
  const [row] = await db
    .select({ n: count() })
    .from(connections)
    .where(
      and(
        eq(connections.initiatorId, userId),
        inArray(connections.status, ["accepted", "completed"]),
        gte(connections.acceptedAt, since),
      ),
    );
  return row?.n ?? 0;
}

// 赚回：双方确认完成的连接（不分我是发布者还是举手方）
async function countCompletedBetween(userId: number, from: Date, to: Date) {
  const window = and(
    eq(connections.status, "completed"),
    gte(connections.completedAt, from),
    lt(connections.completedAt, to),
  );
  const [asInitiator] = await db
    .select({ n: count() })
    .from(connections)
    .where(and(eq(connections.initiatorId, userId), window));
  const [asOwner] = await db
    .select({ n: count() })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .where(and(eq(needs.userId, userId), window));
  return (asInitiator?.n ?? 0) + (asOwner?.n ?? 0);
}

// 赚回：今天在 24 小时内处理掉的举手，接受和拒绝同等计数
async function countPromptHandlesSince(userId: number, since: Date) {
  const rows = await db
    .select({
      createdAt: connections.createdAt,
      updatedAt: connections.updatedAt,
    })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .where(
      and(
        eq(needs.userId, userId),
        inArray(connections.status, ["accepted", "rejected", "completed"]),
        gte(connections.updatedAt, since),
      ),
    );
  const window = QUOTAS.earn.promptHandleHours * HOUR;
  return rows.filter(
    (row) => row.updatedAt.getTime() - row.createdAt.getTime() <= window,
  ).length;
}

// 惩罚：我作为发布者近期处理掉的举手总量与其中接受的数量
async function acceptStatsSince(userId: number, since: Date) {
  const handledIn = (statuses: ("accepted" | "rejected" | "completed")[]) =>
    db
      .select({ n: count() })
      .from(connections)
      .innerJoin(needs, eq(connections.needId, needs.id))
      .where(
        and(
          eq(needs.userId, userId),
          inArray(connections.status, statuses),
          gte(connections.updatedAt, since),
        ),
      );
  const [[handledRow], [acceptedRow]] = await Promise.all([
    handledIn(["accepted", "rejected", "completed"]),
    handledIn(["accepted", "completed"]),
  ]);
  return { handled: handledRow?.n ?? 0, accepted: acceptedRow?.n ?? 0 };
}

// 惩罚：我发出的举手被处理掉的样本与其中被接受的数量
async function myRaiseOutcomes(userId: number) {
  const [resolvedRow] = await db
    .select({ n: count() })
    .from(connections)
    .where(
      and(
        eq(connections.initiatorId, userId),
        inArray(connections.status, ["accepted", "rejected", "completed"]),
      ),
    );
  const [acceptedRow] = await db
    .select({ n: count() })
    .from(connections)
    .where(
      and(
        eq(connections.initiatorId, userId),
        inArray(connections.status, ["accepted", "completed"]),
      ),
    );
  return { resolved: resolvedRow?.n ?? 0, accepted: acceptedRow?.n ?? 0 };
}

/**
 * 诱饵需求检测：举手多且几乎来者不拒的需求停止接收新举手。
 * 与「单条需求累计接受 ≤ 10」是两条线——那条管总量，这条管比例。
 */
export async function isHarvestingNeed(needId: number): Promise<boolean> {
  const [row] = await db
    .select({ raises: countDistinct(connections.initiatorId) })
    .from(connections)
    .where(eq(connections.needId, needId));
  const raises = row?.raises ?? 0;
  if (raises <= QUOTAS.penalty.needHarvestRaises) return false;
  const accepted = await countNeedAccepts(needId);
  return accepted / raises > QUOTAS.penalty.needHarvestRate;
}

export function rejectCooldownActive(
  rejectedAt: Date | null | undefined,
  now = Date.now(),
): boolean {
  if (!rejectedAt) return false;
  return now - rejectedAt.getTime() < QUOTAS.target.rejectCooldownDays * DAY;
}

// —— 事务内同步计数 ——
// better-sqlite3 的事务回调必须同步执行，不能 await。举手/接受把「重查计数 +
// 写库」放进同一个 IMMEDIATE 事务时，用下面这组 *Tx 版本；它们的 SQL 与上面的
// 异步版本一一对应，只是改成同步 .all()。异步的 effectiveDailyLimit（含赚回/惩罚，
// 要跨多表聚合）仍在进事务前算好上限数字传进来。
export type SqliteTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function countRaisesTodayTx(
  tx: SqliteTx,
  userId: number,
  now = Date.now(),
): number {
  const row = tx
    .select({ n: count() })
    .from(connections)
    .where(
      and(
        eq(connections.initiatorId, userId),
        gte(connections.lastRaisedAt, dayStart(now)),
      ),
    )
    .all()[0];
  return row?.n ?? 0;
}

export function countFreshPendingHandsTx(
  tx: SqliteTx,
  userId: number,
  now = Date.now(),
): number {
  const cutoff = new Date(now - QUOTAS.pendingFreshHours * HOUR);
  const row = tx
    .select({ n: count() })
    .from(connections)
    .where(
      and(
        eq(connections.initiatorId, userId),
        eq(connections.status, "pending"),
        gte(connections.createdAt, cutoff),
      ),
    )
    .all()[0];
  return row?.n ?? 0;
}

export function countAcceptedOpenTx(tx: SqliteTx, userId: number): number {
  const asInitiator = tx
    .select({ n: count() })
    .from(connections)
    .where(
      and(eq(connections.initiatorId, userId), eq(connections.status, "accepted")),
    )
    .all()[0];
  const asOwner = tx
    .select({ n: count() })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .where(and(eq(needs.userId, userId), eq(connections.status, "accepted")))
    .all()[0];
  return (asInitiator?.n ?? 0) + (asOwner?.n ?? 0);
}

export function countRaisesToUserTodayTx(
  tx: SqliteTx,
  initiatorId: number,
  targetUserId: number,
  now = Date.now(),
): number {
  const row = tx
    .select({ n: count() })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .where(
      and(
        eq(connections.initiatorId, initiatorId),
        eq(needs.userId, targetUserId),
        gte(connections.lastRaisedAt, dayStart(now)),
      ),
    )
    .all()[0];
  return row?.n ?? 0;
}

export function countNeedAcceptsTx(tx: SqliteTx, needId: number): number {
  const row = tx
    .select({ n: count() })
    .from(connections)
    .where(
      and(
        eq(connections.needId, needId),
        inArray(connections.status, ["accepted", "completed"]),
      ),
    )
    .all()[0];
  return row?.n ?? 0;
}

export function isHarvestingNeedTx(tx: SqliteTx, needId: number): boolean {
  const row = tx
    .select({ raises: countDistinct(connections.initiatorId) })
    .from(connections)
    .where(eq(connections.needId, needId))
    .all()[0];
  const raises = row?.raises ?? 0;
  if (raises <= QUOTAS.penalty.needHarvestRaises) return false;
  const accepted = countNeedAcceptsTx(tx, needId);
  return accepted / raises > QUOTAS.penalty.needHarvestRate;
}

export function countAcceptsTodayTx(
  tx: SqliteTx,
  userId: number,
  now = Date.now(),
): number {
  const row = tx
    .select({ n: count() })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .where(
      and(
        eq(needs.userId, userId),
        inArray(connections.status, ["accepted", "completed"]),
        gte(connections.acceptedAt, dayStart(now)),
      ),
    )
    .all()[0];
  return row?.n ?? 0;
}

export function countRevealsAsProviderTodayTx(
  tx: SqliteTx,
  userId: number,
  now = Date.now(),
): number {
  const row = tx
    .select({ n: count() })
    .from(contactReveals)
    .where(
      and(
        eq(contactReveals.fromUserId, userId),
        gte(contactReveals.createdAt, dayStart(now)),
      ),
    )
    .all()[0];
  return row?.n ?? 0;
}

/** 举手挂满 72 小时无回应：额度已释放，UI 上标为「已无回应」 */
export function isStalePending(
  status: string,
  createdAt: Date,
  now = Date.now(),
): boolean {
  return (
    status === "pending" &&
    now - createdAt.getTime() >= QUOTAS.pendingFreshHours * HOUR
  );
}

export type QuotaLine = {
  key: QuotaKey;
  used: number;
  limit: number;
  base: number;
  penalty: QuotaPenalty | null;
};

export type QuotaStockLine = {
  key: "openNeeds" | "pendingHands" | "acceptedOpen" | "incomingPending" | "pendingJoinRequests";
  used: number;
  max: number;
};

export type QuotaSummary = {
  regular: boolean;
  daily: QuotaLine[];
  stock: QuotaStockLine[];
  staleIncoming: number;
};

/** 「我的 → 额度」一屏所需的全部数字，一次查完 */
export async function getQuotaSummary(
  user: User,
  now = Date.now(),
): Promise<QuotaSummary> {
  const [
    publish,
    raise,
    accept,
    publishUsed,
    raiseUsed,
    acceptUsed,
    openNeeds,
    pendingHands,
    acceptedOpen,
    incomingPending,
    pendingJoins,
    staleIncoming,
  ] = await Promise.all([
    effectiveDailyLimit(user, "need.publish", now),
    effectiveDailyLimit(user, "connection.create", now),
    effectiveDailyLimit(user, "connection.accept", now),
    countNeedsToday(user.id, now),
    countRaisesToday(user.id, now),
    countAcceptsToday(user.id, now),
    countOpenNeeds(user.id, now),
    countFreshPendingHands(user.id, now),
    countAcceptedOpen(user.id),
    countIncomingPending(user.id),
    countPendingJoinRequests(user.id),
    countStaleIncomingPending(user.id, now),
  ]);

  return {
    regular: isRegularAccount(user, now),
    daily: [
      { key: "need.publish", used: publishUsed, ...toLine(publish) },
      { key: "connection.create", used: raiseUsed, ...toLine(raise) },
      { key: "connection.accept", used: acceptUsed, ...toLine(accept) },
    ],
    stock: [
      { key: "openNeeds", used: openNeeds, max: QUOTAS.stock.openNeeds },
      { key: "pendingHands", used: pendingHands, max: QUOTAS.stock.pendingHands },
      { key: "acceptedOpen", used: acceptedOpen, max: QUOTAS.stock.acceptedOpen },
      {
        key: "incomingPending",
        used: incomingPending,
        max: QUOTAS.stock.incomingPending,
      },
      {
        key: "pendingJoinRequests",
        used: pendingJoins,
        max: QUOTAS.stock.pendingJoinRequests,
      },
    ],
    staleIncoming,
  };
}

function toLine(effective: EffectiveLimit) {
  return {
    limit: effective.limit,
    base: effective.base,
    penalty: effective.penalty,
  };
}

/** 剩余额度：只在 ≤ 3 时才该出现在界面上（QUOTA.md 第 11 节） */
export const QUOTA_HINT_THRESHOLD = 3;

/** 举手表单底部的常驻计数，比整张摘要轻 */
export async function getRaiseQuota(
  user: User,
  now = Date.now(),
): Promise<{ pending: number; remaining: number }> {
  const [pending, used, { limit }] = await Promise.all([
    countFreshPendingHands(user.id, now),
    countRaisesToday(user.id, now),
    effectiveDailyLimit(user, "connection.create", now),
  ]);
  return { pending, remaining: Math.max(0, limit - used) };
}

/** 发布按钮旁的剩余计数，只在 ≤ QUOTA_HINT_THRESHOLD 时返回 */
export async function getPublishHint(
  user: User,
  now = Date.now(),
): Promise<{ remaining: number; limit: number } | null> {
  const [used, { limit }] = await Promise.all([
    countNeedsToday(user.id, now),
    effectiveDailyLimit(user, "need.publish", now),
  ]);
  const remaining = Math.max(0, limit - used);
  return remaining <= QUOTA_HINT_THRESHOLD ? { remaining, limit } : null;
}
