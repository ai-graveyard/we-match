import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n/config";
import {
  ADMIN_DICTS,
  LEGAL_DICTS,
  SERVER_DICTS,
  UI_DICTS,
} from "@/lib/i18n/dict";

// 服务端组件的取词入口。语言来自 URL 的 [lang] 段（next/root-params），
// 所以同一个链接在谁手上都是同一门语言。
//
// Server Action 和 Route Handler 用不了 root-params，走 lib/i18n/request.ts。

/** 当前请求的语言；URL 里是不认识的语言段就 404，不静默兜底 */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!isLocale(value)) notFound();
  return value;
}

/** 前台界面文案 */
export async function getDict() {
  return UI_DICTS[await getLocale()];
}

/** 语言已经在手上时的同步取词，给 generateMetadata 这类拿得到 params 的地方用 */
export function uiDictFor(locale: Locale) {
  return UI_DICTS[locale];
}

/** 服务端专用文案（报错、通知模板等） */
export async function getServerDict() {
  return SERVER_DICTS[await getLocale()];
}

/** 管理后台文案 */
export async function getAdminDict() {
  return ADMIN_DICTS[await getLocale()];
}

/** 用户协议与隐私政策正文 */
export async function getLegalDict() {
  return LEGAL_DICTS[await getLocale()];
}
