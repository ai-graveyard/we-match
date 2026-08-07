"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useDict, useLocale } from "@/lib/i18n/client";
import { localePath, stripLocale } from "@/lib/i18n/routing";

type PageVisit = { pathname: string; href: string };

// 只记录“页面”变化。同一 pathname 下的查询、筛选和预览样式切换
// 会更新当前记录，不会成为左上角“返回”的目标。
// NavTracker 挂在根布局，模块级变量跨布局共享。
const pageVisits: PageVisit[] = [];
let pendingBackHref: string | null = null;

export function NavTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    const search = searchParams.toString();
    const href = search ? `${pathname}?${search}` : pathname;
    const current = { pathname, href };
    const last = pageVisits.at(-1);

    if (pendingBackHref === href) {
      pageVisits.pop();
      const previous = pageVisits.at(-1);
      if (previous) previous.href = href;
      else pageVisits.push(current);
      pendingBackHref = null;
      return;
    }

    pendingBackHref = null;
    if (!last) {
      pageVisits.push(current);
    } else if (last.pathname === pathname) {
      last.href = href;
    } else if (pageVisits.at(-2)?.pathname === pathname) {
      // 兼容浏览器手势或系统后退。
      pageVisits.pop();
      pageVisits.at(-1)!.href = href;
    } else {
      pageVisits.push(current);
    }
  }, [pathname, searchParams]);
  return null;
}

function canGoBack(pathname: string) {
  // 整页加载进入（如登录后跳转）：仅在上一个站内记录是不同页面时后退。
  if (
    window.history.length <= 1 ||
    !document.referrer.startsWith(window.location.origin)
  ) {
    return false;
  }
  return new URL(document.referrer).pathname !== pathname;
}

// 直接落地无历史时，各板块的兜底去处（传入的是剥掉语言前缀的路径）
function fallbackFor(path: string) {
  if (path.startsWith("/me/")) return "/me";
  if (path === "/orgs/new") return "/me";
  if (/^\/orgs\/[^/]+/.test(path)) return "/orgs";
  return "/";
}

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useDict();
  return (
    <button
      type="button"
      aria-label={t.common.back}
      onClick={() => {
        const previousPage = pageVisits.at(-2);
        if (previousPage) {
          // 记录里的 href 来自 usePathname，已经带语言前缀
          pendingBackHref = previousPage.href;
          router.replace(previousPage.href);
        } else if (canGoBack(pathname)) {
          router.back();
        } else {
          const { path } = stripLocale(pathname);
          router.replace(localePath(locale, fallbackFor(path)));
        }
      }}
      className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-line bg-panel text-ink transition-colors duration-100 active:translate-y-px active:bg-bg-3 md:hidden"
    >
      <ChevronLeft size={18} aria-hidden />
    </button>
  );
}

// 子页页头行：移动端「返回 + 标题」，桌面端仅标题。
// mobileOnly 用于正文自带标题的详情页——桌面整行隐藏，标题也不作为 h1。
export function PageHeader({
  title,
  action,
  mobileOnly = false,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  mobileOnly?: boolean;
  className?: string;
}) {
  const Title = mobileOnly ? "span" : "h1";
  return (
    <div
      className={`flex items-center gap-3 ${mobileOnly ? "md:hidden" : ""} ${className}`}
    >
      <BackButton />
      <Title className="min-w-0 truncate text-xl font-semibold">{title}</Title>
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </div>
  );
}
