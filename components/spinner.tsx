"use client";

import { LogoSpinner } from "@/components/logo";
import { useDict } from "@/lib/i18n/client";

/** loading.tsx 作为 Suspense fallback 必须同步渲染，取不了 await getDict()，
 *  所以由这个客户端组件从 I18nProvider 的 context 里拿 aria-label。 */
export function Spinner({ height }: { height?: number }) {
  const t = useDict();
  return <LogoSpinner height={height} label={t.common.loading} />;
}
