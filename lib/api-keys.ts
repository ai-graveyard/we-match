import "server-only";
import crypto from "node:crypto";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";

export const API_KEY_LIMITS = {
  perUser: 3, // 每用户 Key 上限，删除即释放名额
  name: 20,
} as const;

export type ApiKeyListItem = {
  id: number;
  name: string;
  lastFour: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function maskApiKey(lastFour: string | null): string {
  return lastFour ? `wm_……${lastFour}` : "wm_……（旧 Key）";
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
): Promise<{ error: string } | { secret: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "请给 Key 起个名字（如「我的 Claude」）" };
  if (trimmed.length > API_KEY_LIMITS.name)
    return { error: `名称最多 ${API_KEY_LIMITS.name} 字` };
  const [row] = await db
    .select({ n: count() })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
  if ((row?.n ?? 0) >= API_KEY_LIMITS.perUser) {
    return {
      error: `最多同时持有 ${API_KEY_LIMITS.perUser} 个 Key，请先删除不用的`,
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
