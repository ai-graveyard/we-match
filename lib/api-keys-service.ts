import "server-only";
import crypto from "node:crypto";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { API_KEY_LIMITS, type ApiKeyListItem } from "@/lib/api-keys";
import type { ServerDict } from "@/lib/i18n/dict/types";
import { fmt } from "@/lib/i18n/fmt";

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function listApiKeys(userId: number): Promise<ApiKeyListItem[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(asc(apiKeys.createdAt));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    lastFour:
      row.lastFour ?? (row.key.startsWith("wm_") ? row.key.slice(-4) : null),
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  }));
}

export async function createApiKey(
  userId: number,
  name: string,
  t: ServerDict,
): Promise<{ error: string } | { secret: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: t.apiKey.emptyName };
  if (trimmed.length > API_KEY_LIMITS.name)
    return { error: fmt(t.apiKey.nameTooLong, { max: API_KEY_LIMITS.name }) };
  const secret = `wm_${crypto.randomBytes(32).toString("base64url")}`;
  // 数量检查和插入必须共用一个 IMMEDIATE 事务。否则两次并发签发都可能
  // 在 count=2 时通过，最终突破每用户 3 把的硬上限。
  return db.transaction(
    (tx) => {
      const row = tx
        .select({ n: count() })
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId))
        .all()[0];
      if ((row?.n ?? 0) >= API_KEY_LIMITS.perUser) {
        return {
          error: fmt(t.apiKey.perUserLimit, { max: API_KEY_LIMITS.perUser }),
        };
      }
      tx.insert(apiKeys)
        .values({
          userId,
          name: trimmed,
          key: hashApiKey(secret),
          lastFour: secret.slice(-4),
          scopes: ["read", "write"],
        })
        .run();
      return { secret };
    },
    { behavior: "immediate" },
  );
}

// 硬删除，即刻失效；只能删自己的
export async function deleteApiKey(userId: number, id: number) {
  await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
}
