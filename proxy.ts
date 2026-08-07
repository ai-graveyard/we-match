import { NextResponse, type NextRequest } from "next/server";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_S,
  isLocale,
} from "@/lib/i18n/config";
import { resolveLocale, stripLocale } from "@/lib/i18n/routing";

/**
 * 语言前缀的唯一入口：
 *  1. 没有前缀的路径（旧链接、外部分享、/）按 cookie → Accept-Language → 中文 重定向；
 *  2. 已经带前缀的照常放行，顺手把 wm_lang cookie 对齐到 URL——
 *     Server Action 和 Route Handler 读不到 next/root-params，只能靠这个 cookie。
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { locale } = stripLocale(pathname);
  const cookieValue = request.cookies.get(LOCALE_COOKIE)?.value;

  if (!locale) {
    const target = resolveLocale(
      cookieValue,
      request.headers.get("accept-language"),
    );
    const url = new URL(
      `/${target}${pathname === "/" ? "" : pathname}${search}`,
      request.url,
    );
    // 307 保留请求方法，避免把 POST 打成 GET
    const response = NextResponse.redirect(url, 307);
    if (cookieValue !== target) setLocaleCookie(response, target);
    return response;
  }

  const response = NextResponse.next();
  if (cookieValue !== locale) setLocaleCookie(response, locale);
  return response;
}

function setLocaleCookie(response: NextResponse, locale: string) {
  if (!isLocale(locale)) return;
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: LOCALE_COOKIE_MAX_AGE_S,
  });
}

export const config = {
  // 开放 API（/api、/skill）不走语言前缀，它们按 Accept-Language 决定语言；
  // _next 与带扩展名的静态资源（含 icon.svg、public 下的文件）一律跳过。
  matcher: [
    "/((?!_next/|api/|skill|icon|apple-icon|opengraph-image|manifest\\.webmanifest|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.[^/]+$).*)",
  ],
};
