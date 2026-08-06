import "server-only";

import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  analyticsEvents,
  auditLogs,
  blocks,
  notifications,
} from "@/lib/db/schema";

export async function notify(input: {
  userId: number;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
}) {
  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title.slice(0, 80),
    body: input.body?.slice(0, 240) || null,
    href: input.href?.slice(0, 500) || null,
  });
}

export async function track(input: {
  name: string;
  userId?: number | null;
  entityType?: string | null;
  entityId?: number | null;
  metadata?: Record<string, unknown> | null;
}) {
  await db.insert(analyticsEvents).values({
    name: input.name,
    userId: input.userId ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function audit(input: {
  actorId?: number | null;
  action: string;
  targetType: string;
  targetId?: number | null;
  metadata?: Record<string, unknown> | null;
}) {
  await db.insert(auditLogs).values({
    actorId: input.actorId ?? null,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function isBlockedEitherWay(firstUserId: number, secondUserId: number) {
  const [row] = await db
    .select({ blockerId: blocks.blockerId })
    .from(blocks)
    .where(
      or(
        and(
          eq(blocks.blockerId, firstUserId),
          eq(blocks.blockedId, secondUserId),
        ),
        and(
          eq(blocks.blockerId, secondUserId),
          eq(blocks.blockedId, firstUserId),
        ),
      ),
    )
    .limit(1);
  return !!row;
}

