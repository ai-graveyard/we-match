"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { connections, needs, orgMembers, users } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isExpired } from "@/lib/needs";
import { isBlockedEitherWay, notify, track } from "@/lib/activity";
import { getRequestDict } from "@/lib/i18n/request";

export type ConnectionFormState = { error?: string; ok?: string };

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

export async function expressInterestAction(
  _prev: ConnectionFormState,
  formData: FormData,
): Promise<ConnectionFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.loginRequired };
  const needId = Number(formData.get("needId"));
  if (!Number.isInteger(needId) || needId <= 0) return { error: t.common.badParams };
  const message = String(formData.get("message") ?? "").trim();
  if (message.length > 200) return { error: t.connection.messageTooLong };

  const [need] = await db.select().from(needs).where(eq(needs.id, needId)).limit(1);
  if (
    !need ||
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

  const [existing] = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.needId, needId),
        eq(connections.initiatorId, user.id),
      ),
    )
    .limit(1);
  if (existing && existing.status !== "rejected" && existing.status !== "cancelled") {
    return { error: t.connection.already };
  }

  const now = new Date();
  if (existing) {
    await db
      .update(connections)
      .set({
        message: message || null,
        status: "pending",
        acceptedAt: null,
        ownerConfirmedAt: null,
        initiatorConfirmedAt: null,
        completedAt: null,
        updatedAt: now,
      })
      .where(eq(connections.id, existing.id));
  } else {
    await db.insert(connections).values({
      needId,
      initiatorId: user.id,
      message: message || null,
    });
  }
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
  refresh();
  return { ok: t.connection.submitted };
}

export async function handleConnectionAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const connectionId = Number(formData.get("connectionId"));
  const decision = String(formData.get("decision"));
  if (!Number.isInteger(connectionId) || !["accept", "reject"].includes(decision)) return;
  const row = await getConnectionContext(connectionId);
  if (!row || row.need.userId !== user.id || row.connection.status !== "pending") return;

  const accepted = decision === "accept";
  await db
    .update(connections)
    .set({
      status: accepted ? "accepted" : "rejected",
      acceptedAt: accepted ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(connections.id, connectionId));
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
  refresh();
}

export async function cancelConnectionAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const connectionId = Number(formData.get("connectionId"));
  if (!Number.isInteger(connectionId)) return;
  const row = await getConnectionContext(connectionId);
  if (
    !row ||
    row.connection.initiatorId !== user.id ||
    !["pending", "accepted"].includes(row.connection.status)
  ) return;
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
  refresh();
}

export async function confirmConnectionCompletedAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const connectionId = Number(formData.get("connectionId"));
  if (!Number.isInteger(connectionId)) return;
  const row = await getConnectionContext(connectionId);
  if (!row || row.connection.status !== "accepted") return;
  const isOwner = row.need.userId === user.id;
  const isInitiator = row.connection.initiatorId === user.id;
  if (!isOwner && !isInitiator) return;

  const now = new Date();
  const ownerConfirmedAt = isOwner ? now : row.connection.ownerConfirmedAt;
  const initiatorConfirmedAt = isInitiator
    ? now
    : row.connection.initiatorConfirmedAt;
  const completed = !!ownerConfirmedAt && !!initiatorConfirmedAt;
  await db
    .update(connections)
    .set({
      ownerConfirmedAt,
      initiatorConfirmedAt,
      status: completed ? "completed" : "accepted",
      completedAt: completed ? now : null,
      updatedAt: now,
    })
    .where(eq(connections.id, connectionId));

  const otherUserId = isOwner ? row.connection.initiatorId : row.need.userId;
  await Promise.all([
    notify({
      userId: otherUserId,
      payload: completed
        ? {
            type: "connection_completed",
            need: row.need.title,
            needId: row.need.id,
          }
        : {
            type: "completion_confirmation_requested",
            name: user.nickname,
            needId: row.need.id,
          },
      href: `/needs/${row.need.id}`,
    }),
    completed
      ? track({
          name: "connection_completed",
          userId: user.id,
          entityType: "connection",
          entityId: connectionId,
        })
      : Promise.resolve(),
  ]);
  refresh();
}
