"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useLocale } from "@/lib/i18n/client";
import { localePath } from "@/lib/i18n/routing";

type LinkProps = ComponentProps<typeof Link>;

/**
 * 站内跳转一律用它，语言前缀自动补。写 href="/needs/new"，
 * 在英文站渲染成 /en/needs/new。外链和 mailto: 原样透传。
 *
 * 服务端组件里也能用：SSR 阶段同样读得到 I18nProvider 的 context。
 */
export function LocaleLink({ href, ...rest }: LinkProps) {
  const locale = useLocale();
  return <Link href={typeof href === "string" ? localePath(locale, href) : href} {...rest} />;
}
