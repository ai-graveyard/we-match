import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { resolveLocale } from "@/lib/i18n/routing";
import { zhServer } from "@/lib/i18n/dict/zh.server";
import { enServer } from "@/lib/i18n/dict/en.server";

// Server Action 与 Route Handler 读不到 next/root-params，这里退回请求本身：
//  - 网页表单提交：proxy 已经把 wm_lang cookie 对齐到 URL，拿到的就是页面语言；
//  - 开放 API：调用方没有 cookie，按 Accept-Language 走，最后兜底中文。

const SERVER = { zh: zhServer, en: enServer };

export async function getRequestLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerList.get("accept-language"),
  );
}

export async function getRequestDict() {
  return SERVER[await getRequestLocale()];
}
