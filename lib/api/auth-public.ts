import "server-only";
import { clientIp } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api/auth";
import { getRequestDict } from "@/lib/i18n/request";
import { fmt } from "@/lib/i18n/fmt";

// /api/v1/auth/* 是全站唯一不要 Key 的写入口（docs/AGENT-SKILL.md 2.2）。
// 别的端点按 Key 限流，这里没有主体可绑，只能按 IP —— 而且要比 Key 那档紧得多：
// 那边一分钟 120 次是给正常轮询留的余量，这边是开号入口，宁可卡到人也不能敞着。
const AUTH_IP_HOURLY_LIMIT = 20;

export async function guardPublicAuthRoute(): Promise<Response | null> {
  const t = await getRequestDict();
  const ip = await clientIp();
  const ok = await consumeRateLimit(
    `auth-api:${ip}`,
    AUTH_IP_HOURLY_LIMIT,
    60 * 60 * 1000,
  );
  if (!ok) {
    return apiError(
      429,
      "rate_limited",
      fmt(t.api.authRateLimited, { max: AUTH_IP_HOURLY_LIMIT }),
    );
  }
  return null;
}
