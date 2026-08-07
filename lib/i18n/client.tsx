"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { UiDict } from "@/lib/i18n/dict/types";

type I18nValue = { locale: Locale; dict: UiDict };

const I18nContext = createContext<I18nValue | null>(null);

/**
 * 根布局挂一次，把当前语言和前台字典交给所有客户端组件。
 * 只下发选中的那一门语言，另一门不会进浏览器包。
 */
export function I18nProvider({
  locale,
  dict,
  children,
}: I18nValue & { children: ReactNode }) {
  return (
    <I18nContext.Provider value={{ locale, dict }}>
      {children}
    </I18nContext.Provider>
  );
}

function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n 必须在 I18nProvider 内使用");
  return value;
}

/** 客户端组件取文案：const t = useDict(); t.common.save */
export function useDict(): UiDict {
  return useI18n().dict;
}

export function useLocale(): Locale {
  return useI18n().locale;
}
