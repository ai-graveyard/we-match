"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { useDict, useLocale } from "@/lib/i18n/client";
import { localePath, stripLocale } from "@/lib/i18n/routing";

// 切语言就是换 URL 前缀，停在当前这一页、保留筛选参数。
// cookie 由 proxy 在下一次请求时对齐，这里不用自己写。
function useSwitchHref() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { path } = stripLocale(pathname);
  return (locale: Locale) =>
    `${localePath(locale, path)}${search ? `?${search}` : ""}`;
}

/** 顶部导航条上的紧凑入口：点一下切到下一门语言 */
function LanguageToggleInner() {
  const t = useDict();
  const locale = useLocale();
  const hrefFor = useSwitchHref();
  const next = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length];

  return (
    <Link
      href={hrefFor(next)}
      prefetch={false}
      aria-label={t.language.toggleLabel}
      title={LOCALE_LABELS[next]}
      className="flex size-8 items-center justify-center rounded-sm text-gray transition-colors duration-100 hover:bg-bg-3 hover:text-ink"
    >
      <Languages size={15} aria-hidden />
    </Link>
  );
}

export function LanguageToggle() {
  return (
    <Suspense fallback={<span className="size-8" />}>
      <LanguageToggleInner />
    </Suspense>
  );
}

/** 「我的 → 设置」里的整行，跟 ThemeToggleRow 一个样式 */
function LanguageToggleRowInner() {
  const t = useDict();
  const locale = useLocale();
  const hrefFor = useSwitchHref();

  return (
    <div className="flex min-h-16 w-full items-center gap-4 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t.language.title}</span>
        <span className="mt-0.5 block text-xs text-gray">
          {t.language.current}
        </span>
      </span>
      <span
        className="grid shrink-0 grid-cols-2 rounded-sm border border-line bg-bg-2 p-0.5"
        role="group"
        aria-label={t.language.toggleLabel}
      >
        {LOCALES.map((item) =>
          item === locale ? (
            <span
              key={item}
              aria-current="true"
              className="flex h-6 items-center justify-center rounded-[5px] bg-ink px-2 font-mono text-3xs text-panel"
            >
              {LOCALE_LABELS[item]}
            </span>
          ) : (
            <Link
              key={item}
              href={hrefFor(item)}
              prefetch={false}
              className="flex h-6 items-center justify-center rounded-[5px] px-2 font-mono text-3xs text-gray transition-colors duration-100 hover:text-ink"
            >
              {LOCALE_LABELS[item]}
            </Link>
          ),
        )}
      </span>
    </div>
  );
}

export function LanguageToggleRow() {
  return (
    <Suspense fallback={<div className="min-h-16" />}>
      <LanguageToggleRowInner />
    </Suspense>
  );
}
