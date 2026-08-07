import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { Brand } from "@/components/brand";
import { getAdminDict } from "@/lib/i18n/server";
import { LocaleLink } from "@/lib/i18n/link";
import { ADMIN_DICTS } from "@/lib/i18n/dict";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]/admin">): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: ADMIN_DICTS[isLocale(lang) ? lang : DEFAULT_LOCALE].metaTitle,
  };
}

export default async function AdminLayout({
  children,
}: LayoutProps<"/[lang]/admin">) {
  const t = await getAdminDict();
  return (
    <>
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 md:px-8">
          <LocaleLink
            href="/admin"
            aria-label={t.homeLabel}
            className="flex min-w-0 items-center gap-2"
          >
            <Brand />
            <span className="h-4 w-px shrink-0 bg-line" aria-hidden />
            <span className="shrink-0 text-xs font-semibold">{t.title}</span>
          </LocaleLink>
          <LocaleLink
            href="/"
            className="inline-flex shrink-0 items-center gap-1 text-xs text-gray transition-colors duration-100 hover:text-ink"
          >
            <ChevronLeft size={13} aria-hidden />
            {t.backToApp}
          </LocaleLink>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-6 md:px-8">
        {children}
      </main>
    </>
  );
}
