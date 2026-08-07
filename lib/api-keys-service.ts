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
  const [row] = await db
    .select({ n: count() })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
  if ((row?.n ?? 0) >= API_KEY_LIMITS.perUser) {
    return {
      error: fmt(t.apiKey.perUserLimit, { max: API_KEY_LIMITS.perUser }),
    };
  }
  const secret = `wm_${crypto.randomBytes(32).toString("base64url")}`;
  await db
    .insert(apiKeys)
    .values({
      userId,
      name: trimmed,
      key: hashApiKey(secret),
      lastFour: secret.slice(-4),
      scopes: ["read", "write"],
    });
  return { secret };
}

// 硬删除，即刻失效；只能删自己的
export async function deleteApiKey(userId: number, id: number) {
  await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
}
