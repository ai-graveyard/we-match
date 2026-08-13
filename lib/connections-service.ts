import "server-only";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  connections,
  contactReveals,
  blocks,
  needs,
  orgMembers,
  users,
  type User,
} from "@/lib/db/schema";
import { isExpired } from "@/lib/needs";
import {
  CONTACT_FIELDS,
  fieldVisibility,
  type ContactFieldKey,
} from "@/lib/card";
import { isBlockedEitherWay, notify, track } from "@/lib/activity";
import {
  checkQuota,
  countAcceptedOpenTx,
  countAcceptsTodayTx,
  countFreshPendingHandsTx,
  countNeedAcceptsTx,
  countRaisesToUserTodayTx,
  countRaisesTodayTx,
  countRevealsAsProviderTodayTx,
  effectiveDailyLimit,
  isHarvestingNeedTx,
  QUOTAS,
  rejectCooldownActive,
  type SqliteTx,
} from "@/lib/quota";
import { fmt } from "@/lib/i18n/fmt";
import type { ServerDict } from "@/lib/i18n/dict/types";

// 举手写路径：网页 Action 与后续开放 API 共用的状态机

type Actor = Pick<User, "id" | "nickname">;

export async function revealedFieldsTo(
  fromUserId: number,
  toUserId: number,
): Promise<Set<ContactFieldKey>> {
  if (await isBlockedEitherWay(fromUserId, toUserId)) return new Set();
  const rows = await db
    .select({ field: contactReveals.field })
    .from(contactReveals)
    .innerJoin(connections, eq(contactReveals.connectionId, connections.id))
    .innerJoin(needs, eq(contactReveals.needId, needs.id))
    .where(
      and(
        eq(contactReveals.fromUserId, fromUserId),
        eq(contactReveals.toUserId, toUserId),
        inArray(connections.status, ["accepted", "completed"]),
        isNull(needs.deletedAt),
      ),
    );
  return new Set(rows.map((row) => row.field));
}

function exchangeableContacts(user: User): ContactFieldKey[] {
  return CONTACT_FIELDS.filter((field) => {
    if (!user[field.key]) return false;
    return fieldVisibility(user.fieldVisibility, field.key) !== "hidden";
  }).map((field) => field.key);
}

function resolveInitiatorContact(
  user: User,
  requested: string | undefined,
): ContactFieldKey | null {
  const available = exchangeableContacts(user);
  if (
    requested === "wechat" ||
    requested === "email" ||
    requested === "contactPhone"
  ) {
    return available.includes(requested) ? requested : null;
  }
  return available[0] ?? null;
}

async function getConnectionContext(connectionId: number) {
  const [row] = await db
    .select({ connection: connections, need: needs, initiator: users })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .innerJoin(users, eq(connections.initiatorId, users.id))
    .where(eq(connections.id, connectionId))
    .limit(1);
  return row ?? null;
}

export async function expressInterest(
  user: User,
  input: { needId: number; message: string; contact?: string },
  t: ServerDict,
): Promise<{ error: string } | { ok: true }> {
  const { needId, message } = input;
  if (!Number.isInteger(needId) || needId <= 0) return { error: t.common.badParams };
  if (message.length > 200) return { error: t.connection.messageTooLong };

  const initiatorContact = resolveInitiatorContact(user, input.contact);
  if (!initiatorContact) return { error: t.connection.contactUnavailable };

  const [need] = await db.select().from(needs).where(eq(needs.id, needId)).limit(1);
  if (
    !need ||
    need.deletedAt != null ||
    need.userId === user.id ||
    need.status !== "open" ||
    need.moderationStatus !== "visible" ||
    isExpired(need)
  ) {
    return { error: t.connection.notOpen };
  }
  if (await isBlockedEitherWay(user.id, need.userId)) {
    return { error: t.connection.blocked };
  }
  if (need.orgId != null) {
    const [membership] = await db
      .select({ userId: orgMembers.userId })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, need.orgId), eq(orgMembers.userId, user.id)))
      .limit(1);
    if (!membership) return { error: t.connection.needNotFound };
  }

  // 外层 checkQuota 消耗节流令牌、快速失败并给出准确文案；随后的写入放进
  // IMMEDIATE 事务，事务内再同步重查状态机与额度，堵住「检查完到写入之间」
  // 的并发窗口（同 createNeed 的模式）。
  const quota = await checkQuota(user, "connection.create", t, {
    userId: need.userId,
    needId: need.id,
  });
  if (!quota.ok) return { error: quota.message };
  const { limit: raiseMax, penalty: raisePenalty } = await effectiveDailyLimit(
    user,
    "connection.create",
  );

  const now = new Date();
  const written = db.transaction(
    (tx): { error: string } | { ok: true } => {
      const currentNeed = tx
        .select()
        .from(needs)
        .where(eq(needs.id, needId))
        .limit(1)
        .all()[0];
      if (
        !currentNeed ||
        currentNeed.deletedAt != null ||
        currentNeed.userId === user.id ||
        currentNeed.status !== "open" ||
        currentNeed.moderationStatus !== "visible" ||
        isExpired(currentNeed)
      ) {
        return { error: t.connection.notOpen };
      }
      const block = tx
        .select({ blockerId: blocks.blockerId })
        .from(blocks)
        .where(
          or(
            and(
              eq(blocks.blockerId, user.id),
              eq(blocks.blockedId, currentNeed.userId),
            ),
            and(
              eq(blocks.blockerId, currentNeed.userId),
              eq(blocks.blockedId, user.id),
            ),
          ),
        )
        .limit(1)
        .all()[0];
      if (block) return { error: t.connection.blocked };
      if (currentNeed.orgId != null) {
        const membership = tx
          .select({ userId: orgMembers.userId })
          .from(orgMembers)
          .where(
            and(
              eq(orgMembers.orgId, currentNeed.orgId),
              eq(orgMembers.userId, user.id),
            ),
          )
          .limit(1)
          .all()[0];
        if (!membership) return { error: t.connection.needNotFound };
      }
      const existing = tx
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.needId, needId),
            eq(connections.initiatorId, user.id),
          ),
        )
        .limit(1)
        .all()[0];
      if (
        existing &&
        existing.status !== "rejected" &&
        existing.status !== "cancelled"
      ) {
        return { error: t.connection.already };
      }
      if (existing?.status === "rejected" && rejectCooldownActive(existing.updatedAt)) {
        return { error: t.connection.rejectCooldown };
      }
      if (
        existing?.status === "cancelled" &&
        existing.raiseCount >= 1 + QUOTAS.target.cancelResendMax
      ) {
        return { error: t.connection.resendLimit };
      }

      if (countFreshPendingHandsTx(tx, user.id) >= QUOTAS.stock.pendingHands) {
        return {
          error: fmt(t.quota.pendingStock, { max: QUOTAS.stock.pendingHands }),
        };
      }
      if (countAcceptedOpenTx(tx, user.id) >= QUOTAS.stock.acceptedOpen) {
        return {
          error: fmt(t.quota.acceptedStock, { max: QUOTAS.stock.acceptedOpen }),
        };
      }
      if (countNeedAcceptsTx(tx, currentNeed.id) >= QUOTAS.target.acceptPerNeed) {
        return { error: t.quota.needAcceptCap };
      }
      if (isHarvestingNeedTx(tx, currentNeed.id)) {
        return { error: t.quota.needClosedToRaises };
      }
      if (
        countRaisesToUserTodayTx(tx, user.id, currentNeed.userId) >=
        QUOTAS.target.sameUserPerDay
      ) {
        return { error: t.quota.sameUserDaily };
      }
      if (countRaisesTodayTx(tx, user.id) >= raiseMax) {
        return {
          error: raisePenalty
            ? t.quota.penaltyRaise
            : fmt(t.quota.raiseDaily, { max: raiseMax }),
        };
      }

      if (existing) {
        tx
          .update(connections)
          .set({
            message: message || null,
            initiatorContact,
            status: "pending",
            raiseCount: existing.raiseCount + 1,
            lastRaisedAt: now,
            acceptedAt: null,
            ownerConfirmedAt: null,
            initiatorConfirmedAt: null,
            completedAt: null,
            updatedAt: now,
          })
          .where(eq(connections.id, existing.id))
          .run();
      } else {
        tx
          .insert(connections)
          .values({
            needId,
            initiatorId: user.id,
            message: message || null,
            initiatorContact,
          })
          .run();
      }
      return { ok: true };
    },
    { behavior: "immediate" },
  );
  if ("error" in written) return written;

  await Promise.all([
    notify({
      userId: need.userId,
      payload: {
        type: "connection_requested",
        name: user.nickname,
        need: need.title,
        needId: need.id,
        message: message || null,
      },
      href: `/needs/${need.id}`,
    }),
    track({
      name: "connection_requested",
      userId: user.id,
      entityType: "need",
      entityId: need.id,
    }),
  ]);
  return { ok: true };
}

function writeRevealsTx(
  tx: SqliteTx,
  input: {
    connectionId: number;
    needId: number;
    ownerId: number;
    initiatorId: number;
    ownerField: ContactFieldKey;
    initiatorField: ContactFieldKey;
  },
) {
  tx
    .insert(contactReveals)
    .values([
      {
        connectionId: input.connectionId,
        needId: input.needId,
        fromUserId: input.ownerId,
        toUserId: input.initiatorId,
        field: input.ownerField,
      },
      {
        connectionId: input.connectionId,
        needId: input.needId,
        fromUserId: input.initiatorId,
        toUserId: input.ownerId,
        field: input.initiatorField,
      },
    ])
    .run();
}

export async function handleConnection(
  user: User,
  input: { connectionId: number; decision: "accept" | "reject" },
  t?: ServerDict,
): Promise<{ ok: true } | { error: string } | null> {
  const { connectionId, decision } = input;
  if (!Number.isInteger(connectionId) || !["accept", "reject"].includes(decision)) {
    return null;
  }
  const row = await getConnectionContext(connectionId);
  if (!row || row.need.userId !== user.id || row.connection.status !== "pending") {
    return null;
  }

  if (decision === "accept") {
    if (!t) return null;
    if (
      row.need.deletedAt != null ||
      row.need.status !== "open" ||
      row.need.moderationStatus !== "visible" ||
      row.initiator.status !== "active" ||
      isExpired(row.need)
    ) {
      return { error: t.connection.notOpen };
    }
    if (await isBlockedEitherWay(user.id, row.connection.initiatorId)) {
      return { error: t.connection.blocked };
    }
    if (row.need.orgId != null) {
      const [membership] = await db
        .select({ userId: orgMembers.userId })
        .from(orgMembers)
        .where(
          and(
            eq(orgMembers.orgId, row.need.orgId),
            eq(orgMembers.userId, row.connection.initiatorId),
          ),
        )
        .limit(1);
      if (!membership) return { error: t.connection.needNotFound };
    }
    const quota = await checkQuota(user, "connection.accept", t, {
      needId: row.need.id,
    });
    if (!quota.ok) return { error: quota.message };

    const { limit: acceptMax, penalty: acceptPenalty } = await effectiveDailyLimit(
      user,
      "connection.accept",
    );

    // 接受与双向揭示写在同一个 IMMEDIATE 事务：要么都成，要么都不成，
    // 不会出现「已接受但没揭示联系方式」。带 status='pending' 的条件更新
    // 保证同一条举手被并发接受时只落一次。
    const result = db.transaction(
      (tx): { error: string } | { ok: true } | null => {
        const current = tx
          .select({ connection: connections, need: needs, initiator: users })
          .from(connections)
          .innerJoin(needs, eq(connections.needId, needs.id))
          .innerJoin(users, eq(connections.initiatorId, users.id))
          .where(eq(connections.id, connectionId))
          .limit(1)
          .all()[0];
        if (!current || current.connection.status !== "pending") return null;
        if (
          current.need.userId !== user.id ||
          current.need.deletedAt != null ||
          current.need.status !== "open" ||
          current.need.moderationStatus !== "visible" ||
          current.initiator.status !== "active" ||
          isExpired(current.need)
        ) {
          return { error: t.connection.notOpen };
        }
        const blocked = tx
          .select({ blockerId: blocks.blockerId })
          .from(blocks)
          .where(
            or(
              and(
                eq(blocks.blockerId, user.id),
                eq(blocks.blockedId, current.connection.initiatorId),
              ),
              and(
                eq(blocks.blockerId, current.connection.initiatorId),
                eq(blocks.blockedId, user.id),
              ),
            ),
          )
          .limit(1)
          .all()[0];
        if (blocked) return { error: t.connection.blocked };
        if (current.need.orgId != null) {
          const member = tx
            .select({ userId: orgMembers.userId })
            .from(orgMembers)
            .where(
              and(
                eq(orgMembers.orgId, current.need.orgId),
                eq(orgMembers.userId, current.connection.initiatorId),
              ),
            )
            .limit(1)
            .all()[0];
          if (!member) return { error: t.connection.needNotFound };
        }
        const ownerField = resolveInitiatorContact(
          user,
          current.need.preferredContact ?? undefined,
        );
        const initiatorField = resolveInitiatorContact(
          current.initiator,
          current.connection.initiatorContact ?? undefined,
        );
        if (!ownerField || !initiatorField) {
          return { error: t.connection.contactUnavailable };
        }
        if (countNeedAcceptsTx(tx, current.need.id) >= QUOTAS.target.acceptPerNeed) {
          return { error: t.quota.needAcceptCap };
        }
        if (
          countRevealsAsProviderTodayTx(tx, user.id) >=
          QUOTAS.target.dailyRevealsAsProvider
        ) {
          return {
            error: fmt(t.quota.revealDaily, {
              max: QUOTAS.target.dailyRevealsAsProvider,
            }),
          };
        }
        if (countAcceptsTodayTx(tx, user.id) >= acceptMax) {
          return {
            error: acceptPenalty
              ? t.quota.penaltyAccept
              : fmt(t.quota.acceptDaily, { max: acceptMax }),
          };
        }

        const now = new Date();
        const updated = tx
          .update(connections)
          .set({
            status: "accepted",
            acceptedAt: now,
            initiatorContact: initiatorField,
            updatedAt: now,
          })
          .where(
            and(eq(connections.id, connectionId), eq(connections.status, "pending")),
          )
          .returning({ id: connections.id })
          .all();
        if (updated.length === 0) return null;
        writeRevealsTx(tx, {
          connectionId,
          needId: current.need.id,
          ownerId: user.id,
          initiatorId: current.connection.initiatorId,
          ownerField,
          initiatorField,
        });
        return { ok: true };
      },
      { behavior: "immediate" },
    );
    if (result === null || "error" in result) return result;
  } else {
    const rejected = db.transaction(
      (tx) =>
        tx
          .update(connections)
          .set({
            status: "rejected",
            acceptedAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(eq(connections.id, connectionId), eq(connections.status, "pending")),
          )
          .returning({ id: connections.id })
          .all(),
      { behavior: "immediate" },
    );
    if (rejected.length === 0) return null;
  }

  const accepted = decision === "accept";
  await Promise.all([
    notify({
      userId: row.connection.initiatorId,
      payload: {
        type: accepted ? "connection_accepted" : "connection_rejected",
        name: user.nickname,
        need: row.need.title,
        needId: row.need.id,
      },
      href: `/needs/${row.need.id}`,
    }),
    track({
      name: accepted ? "connection_accepted" : "connection_rejected",
      userId: user.id,
      entityType: "connection",
      entityId: connectionId,
    }),
  ]);
  return { ok: true };
}

export async function cancelConnection(
  user: Actor,
  connectionId: number,
): Promise<{ ok: true } | null> {
  if (!Number.isInteger(connectionId)) return null;
  const row = await getConnectionContext(connectionId);
  if (
    !row ||
    row.connection.initiatorId !== user.id ||
    !["pending", "accepted"].includes(row.connection.status)
  ) {
    return null;
  }
  await db
    .update(connections)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(connections.id, connectionId));
  await notify({
    userId: row.need.userId,
    payload: {
      type: "connection_cancelled",
      name: user.nickname,
      need: row.need.title,
      needId: row.need.id,
    },
    href: `/needs/${row.need.id}`,
  });
  return { ok: true };
}

export async function confirmConnectionCompleted(
  user: Actor,
  connectionId: number,
): Promise<{ ok: true; completed: boolean } | null> {
  if (!Number.isInteger(connectionId)) return null;
  const result = db.transaction(
    (tx) => {
      const row = tx
        .select({ connection: connections, need: needs })
        .from(connections)
        .innerJoin(needs, eq(connections.needId, needs.id))
        .where(eq(connections.id, connectionId))
        .limit(1)
        .all()[0];
      if (
        !row ||
        row.need.deletedAt != null ||
        row.connection.status !== "accepted"
      ) return null;
      const isOwner = row.need.userId === user.id;
      const isInitiator = row.connection.initiatorId === user.id;
      if (!isOwner && !isInitiator) return null;

      const alreadyConfirmed = isOwner
        ? row.connection.ownerConfirmedAt != null
        : row.connection.initiatorConfirmedAt != null;
      if (alreadyConfirmed) {
        return {
          completed: false,
          changed: false,
          otherUserId: isOwner ? row.connection.initiatorId : row.need.userId,
          needId: row.need.id,
          needTitle: row.need.title,
        };
      }

      const now = new Date();
      tx.update(connections)
        .set(
          isOwner
            ? { ownerConfirmedAt: now, updatedAt: now }
            : { initiatorConfirmedAt: now, updatedAt: now },
        )
        .where(and(eq(connections.id, connectionId), eq(connections.status, "accepted")))
        .run();
      const updated = tx
        .select({
          ownerConfirmedAt: connections.ownerConfirmedAt,
          initiatorConfirmedAt: connections.initiatorConfirmedAt,
        })
        .from(connections)
        .where(eq(connections.id, connectionId))
        .limit(1)
        .all()[0];
      const completed = !!updated?.ownerConfirmedAt && !!updated.initiatorConfirmedAt;
      if (completed) {
        tx.update(connections)
          .set({ status: "completed", completedAt: now, updatedAt: now })
          .where(and(eq(connections.id, connectionId), eq(connections.status, "accepted")))
          .run();
      }
      return {
        completed,
        changed: true,
        otherUserId: isOwner ? row.connection.initiatorId : row.need.userId,
        needId: row.need.id,
        needTitle: row.need.title,
      };
    },
    { behavior: "immediate" },
  );
  if (!result) return null;
  if (!result.changed) return { ok: true, completed: result.completed };

  await Promise.all([
    notify({
      userId: result.otherUserId,
      payload: result.completed
        ? {
            type: "connection_completed",
            need: result.needTitle,
            needId: result.needId,
          }
        : {
            type: "completion_confirmation_requested",
            name: user.nickname,
            needId: result.needId,
          },
      href: `/needs/${result.needId}`,
    }),
    result.completed
      ? track({
          name: "connection_completed",
          userId: user.id,
          entityType: "connection",
          entityId: connectionId,
        })
      : Promise.resolve(),
  ]);
  return { ok: true, completed: result.completed };
}
