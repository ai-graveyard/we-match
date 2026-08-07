import type { Locale } from "@/lib/i18n/config";
import { zh } from "@/lib/i18n/dict/zh";
import { en } from "@/lib/i18n/dict/en";
import { zhServer } from "@/lib/i18n/dict/zh.server";
import { enServer } from "@/lib/i18n/dict/en.server";
import { zhAdmin } from "@/lib/i18n/dict/zh.admin";
import { enAdmin } from "@/lib/i18n/dict/en.admin";
import { zhLegal } from "@/lib/i18n/dict/zh.legal";
import { enLegal } from "@/lib/i18n/dict/en.legal";

// 语言 → 字典。不碰 next 的任何 API，所以 manifest、OG 图这些
// 拿不到 [lang] 段的地方也能直接按默认语言取词。

export const UI_DICTS: Record<Locale, typeof zh> = { zh, en };
export const SERVER_DICTS: Record<Locale, typeof zhServer> = {
  zh: zhServer,
  en: enServer,
};
export const ADMIN_DICTS: Record<Locale, typeof zhAdmin> = {
  zh: zhAdmin,
  en: enAdmin,
};
export const LEGAL_DICTS: Record<Locale, typeof zhLegal> = {
  zh: zhLegal,
  en: enLegal,
};

export function uiDict(locale: Locale) {
  return UI_DICTS[locale];
}
