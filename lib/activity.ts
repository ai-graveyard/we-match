import "server-only";

import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  analyticsEvents,
  auditLogs,
  blocks,
  notifications,
} from "@/lib/db/schema";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { SERVER_DICTS } from "@/lib/i18n/dict";
import {
  renderNotification,
  type NotificationPayload,
} from "@/lib/notifications";

// 存 type + params，读的时候按查看者的语言渲染（见 lib/notifications.ts）。
// title / body 同时按默认语言写一份快照：数据库里 title 是 NOT NULL，
// 而且万一以后 params 结构变了，列表还有东西可显示。
export async function notify(input: {
  userId: number;
  payload: NotificationPayload;
  href?: string | null;
}) {
  const { type, ...params } = input.payload;
  const snapshot = renderNotification(
    SERVER_DICTS[DEFAULT_LOCALE],
    input.payload,
  );
  await db.insert(notifications).values({
    userId: input.userId,
    type,
    title: snapshot.title.slice(0, 80),
    body: snapshot.body?.slice(0, 240) || null,
    params,
    // href 不带语言前缀，点开时再按当时的语言补
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

