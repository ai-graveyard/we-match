import { and, desc, eq, gte, lt, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { apiError, authenticate } from "@/lib/api/auth";
import {
  apiLimit,
  decodeCursor,
  encodeCursor,
  parseSince,
} from "@/lib/api/pagination";
import { getRequestDict } from "@/lib/i18n/request";
import { notificationText } from "@/lib/notifications";

// Agent 只读通知；readAt 仍只允许人在网页上写，避免 Agent 吞掉审计窗口。
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;

  const params = new URL(request.url).searchParams;
  const t = await getRequestDict();
  const since = parseSince(params.get("since"));
  if (since === "invalid") return apiError(422, "invalid_since", t.api.badSince);
  const cursor = decodeCursor(params.get("cursor"));
  if (cursor === "invalid") return apiError(422, "invalid_cursor", t.api.badCursor);

  const conds: SQL[] = [eq(notifications.userId, auth.user.id)];
  if (since) conds.push(gte(notifications.createdAt, since));
  if (cursor) {
    conds.push(
      or(
        lt(notifications.createdAt, cursor.at),
        and(
          eq(notifications.createdAt, cursor.at),
          lt(notifications.id, cursor.id),
        ),
      )!,
    );
  }

  const limit = apiLimit(params.get("limit"));
  const fetched = await db
    .select()
    .from(notifications)
    .where(and(...conds))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);
  const hasMore = fetched.length > limit;
  const rows = fetched.slice(0, limit);
  const last = rows.at(-1);

  return Response.json({
    notifications: rows.map((row) => {
      const rendered = notificationText(t, row);
      return {
        id: row.id,
        type: row.type,
        title: rendered.title,
        body: rendered.body,
        href: row.href,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      };
    }),
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  });
}
