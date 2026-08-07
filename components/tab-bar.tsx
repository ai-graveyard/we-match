"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { Brand } from "@/components/brand";
import { useDict } from "@/lib/i18n/client";
import { LocaleLink } from "@/lib/i18n/link";
import { stripLocale } from "@/lib/i18n/routing";
import type { UiDict } from "@/lib/i18n/dict/types";

const TABS = [
  { href: "/", label: (t: UiDict) => t.nav.plaza },
  { href: "/me", label: (t: UiDict) => t.nav.me },
] as const;

// pathname 带语言前缀，比较前先剥掉
function isActive(pathname: string, href: string) {
  const { path } = stripLocale(pathname);
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function TabBar() {
  const pathname = usePathname();
  const t = useDict();
  return (
    // fixed 相对视口定位，吃不到 body 的左右安全区内边距，横屏刘海会压住 Tab 文字，
    // 所以这里自己垫一份（见 globals.css 的 --safe-l / --safe-r）
    <nav className="fixed inset-x-0 bottom-0 z-10 grid h-[var(--tabbar-h)] grid-cols-2 border-t border-line bg-panel pb-[var(--safe-b)] pl-[var(--safe-l)] pr-[var(--safe-r)] md:hidden">
      {TABS.map((tab) => (
        <LocaleLink
          key={tab.href}
          href={tab.href}
          className={`flex items-center justify-center text-base ${
            isActive(pathname, tab.href)
              ? "font-semibold text-accent"
              : "text-gray"
          }`}
        >
          {tab.label(t)}
        </LocaleLink>
      ))}
    </nav>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const t = useDict();
  return (
    <header className="hidden border-b border-line bg-panel md:block">
      <div className="mx-auto flex h-16 w-full max-w-[640px] items-center justify-between px-8">
        <LocaleLink
          href="/"
          aria-label={t.brand.homeLabel}
          className="flex items-center gap-3"
        >
          <Brand />
          <span className="h-4 w-px bg-line" aria-hidden />
          <span className="text-2xs text-gray">{t.brand.slogan}</span>
        </LocaleLink>
        <div className="flex items-center gap-4">
          <nav className="flex gap-8">
            {TABS.map((tab) => (
              <LocaleLink
                key={tab.href}
                href={tab.href}
                className={`text-xs tracking-[0.08em] ${
                  isActive(pathname, tab.href)
                    ? "font-semibold text-accent"
                    : "text-gray hover:text-ink"
                }`}
              >
                {tab.label(t)}
              </LocaleLink>
            ))}
          </nav>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
