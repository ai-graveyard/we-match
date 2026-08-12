import "server-only";
import { headers } from "next/headers";

// 当前站点 origin：优先反代头（生产部署在 wematch.v2ai.org，经 nginx 转发），
// 兜底 Host。自部署/开发环境自动得到各自的地址，无需配置
export async function siteOrigin(): Promise<string> {
  const configured = normalizedOrigin(process.env.SITE_ORIGIN);
  if (configured) return configured;

  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "wematch.v2ai.org";
  const rawProto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  return normalizedOrigin(`${rawProto}://${host}`) ?? "https://wematch.v2ai.org";
}

function normalizedOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}
