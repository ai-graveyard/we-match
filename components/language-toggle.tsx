"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { useDict, useLocale } from "@/lib/i18n/client";
import { localePath, stripLocale } from "@/lib/i18n/routing";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { settingsRow } from "@/lib/ui";

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
    <div className={settingsRow}>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t.language.title}</span>
        <span className="mt-0.5 block text-xs text-gray">
          {t.language.current}
        </span>
      </span>
      <ToggleGroup type="single" value={locale} aria-label={t.language.toggleLabel}>
        {LOCALES.map((item) => (
          <ToggleGroupItem key={item} value={item} asChild>
            <Link href={hrefFor(item)} prefetch={false} aria-current={item === locale ? "true" : undefined}>{LOCALE_LABELS[item]}</Link>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
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
