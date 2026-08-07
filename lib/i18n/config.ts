// 站点支持的语言。新增一门语言只需在这里加一项，再补齐 lib/i18n/dict 下的同名字典，
// TypeScript 会把所有缺失的键报出来。
export const LOCALES = ["zh", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh";

// 记住用户选择。Server Action 和 Route Handler 读不到 next/root-params，
// 只能靠这个 cookie 拿语言，所以 proxy 每次请求都会把它跟 URL 对齐。
export const LOCALE_COOKIE = "wm_lang";
export const LOCALE_COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;

/** 语言切换控件上的自称，各自用本语言写 */
export const LOCALE_LABELS: Record<Locale, string> = {
  zh: "中文",
  en: "English",
};

/** <html lang> 与 Intl 用的 BCP 47 标签 */
export const HTML_LANG: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
