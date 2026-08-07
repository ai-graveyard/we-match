import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from "@/lib/i18n/config";

// 纯函数，不碰 next/headers，proxy、服务端组件和浏览器都能用。

/** 给站内路径加上语言前缀：("en", "/needs/new") → "/en/needs/new" */
export function localePath(locale: Locale, path: string): string {
  if (!path.startsWith("/")) return path; // 外链、mailto: 之类原样返回
  const { path: bare } = stripLocale(path);
  return bare === "/" ? `/${locale}` : `/${locale}${bare}`;
}

/** 拆出路径里的语言前缀。没有前缀时 locale 为 null，交给调用方决定兜底 */
export function stripLocale(pathname: string): {
  locale: Locale | null;
  path: string;
} {
  const [, first = "", ...rest] = pathname.split("/");
  if (!isLocale(first)) return { locale: null, path: pathname };
  const path = `/${rest.join("/")}`;
  return { locale: first, path: path === "/" && rest.length === 0 ? "/" : path };
}

/**
 * 从 Accept-Language 挑一门支持的语言。只做前缀匹配（zh-CN、zh-Hans 都算 zh），
 * 够用且不必引 negotiator。
 */
export function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((item) => item.tag && !Number.isNaN(item.q))
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    const hit = LOCALES.find((locale) => locale === base);
    if (hit) return hit;
  }
  return null;
}

/** cookie 优先（用户显式选过），其次浏览器偏好，最后默认中文 */
export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  return localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}
