import "server-only";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys, users, type User } from "@/lib/db/schema";
import { hashApiKey } from "@/lib/api-keys";
import { consumeRateLimit } from "@/lib/rate-limit";

// 开放 API 鉴权与限流（docs/AGENT-SKILL.md 3.1）

const RATE_LIMIT_PER_MINUTE = 120;
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000; // last_used_at 写库节流

export function apiError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export type ApiAuth = { user: User };

export async function authenticate(request: Request): Promise<ApiAuth | Response> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(wm_[A-Za-z0-9_-]+)$/.exec(header);
  if (!match) {
    return apiError(
      401,
      "unauthorized",
      "缺少 API Key，请求头需带 Authorization: Bearer <Key>",
    );
  }
  const rawKey = match[1];
  const keyHash = hashApiKey(rawKey);
  const [row] = await db
    .select({ key: apiKeys, user: users })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    // 兼容升级前的明文记录；成功鉴权后立即替换为哈希。
    .where(or(eq(apiKeys.key, keyHash), eq(apiKeys.key, rawKey)))
    .limit(1);
  if (!row) return apiError(401, "unauthorized", "API Key 无效或已被删除");
  if (row.user.status === "suspended") {
    return apiError(403, "account_suspended", "账号已暂停使用");
  }
  // 注销时 Key 已删除，走不到这里；防御历史数据或并发窗口
  if (row.user.status === "deleted") {
    return apiError(403, "account_deleted", "账号已注销");
  }
  if (row.key.key === rawKey) {
    await db
      .update(apiKeys)
      .set({ key: keyHash, lastFour: rawKey.slice(-4) })
      .where(eq(apiKeys.id, row.key.id));
  }

  // SQLite 持久化固定窗口限流，重启或多进程不会清零。
  const now = Date.now();
  if (!(await consumeRateLimit(`api:${row.key.id}`, RATE_LIMIT_PER_MINUTE, 60_000))) {
    return apiError(
      429,
      "rate_limited",
      `请求过于频繁（每 Key 每分钟 ${RATE_LIMIT_PER_MINUTE} 次），请稍后再试`,
    );
  }

  if (
    !row.key.lastUsedAt ||
    now - row.key.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS
  ) {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row.key.id));
  }

  // 权限已收敛为单一读写档；历史只读 Key 也按完整读写权限处理。
  return { user: row.user };
}

// 读取 JSON 对象 body；不合法返回 null（空 body 视为 {}，需求接口用于快速续期）
export async function readJson(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    const body: unknown = JSON.parse(text);
    if (typeof body !== "object" || body === null || Array.isArray(body))
      return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}
