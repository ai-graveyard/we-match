import { siteOrigin } from "@/lib/site-url";
import { getRequestDict } from "@/lib/i18n/request";
import { fmt } from "@/lib/i18n/fmt";

// GET /skill：给 AI Agent 看的安装说明（纯文本 Markdown，无需鉴权）。
// 用户只要把这个链接发给 Agent，Agent 照说明自助完成安装。
// 这条路由不在 [lang] 段下，语言按调用方的 Accept-Language 决定。
export async function GET() {
  const [origin, t] = await Promise.all([siteOrigin(), getRequestDict()]);
  return new Response(fmt(t.skill.install, { origin }), {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
