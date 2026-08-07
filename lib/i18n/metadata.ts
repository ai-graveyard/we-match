import type { Metadata } from "next";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { uiDict } from "@/lib/i18n/dict";
import type { UiDict } from "@/lib/i18n/dict/types";

/**
 * 只有标题随语言变的页面用它：
 *   export const generateMetadata = pageTitle((t) => t.org.metaNew);
 * 标题后面的「· We Match」由根布局的 template 补。
 */
export function pageTitle(pick: (dict: UiDict) => string) {
  return async ({
    params,
  }: {
    params: Promise<{ lang: string }>;
  }): Promise<Metadata> => {
    const { lang } = await params;
    return { title: pick(uiDict(isLocale(lang) ? lang : DEFAULT_LOCALE)) };
  };
}
