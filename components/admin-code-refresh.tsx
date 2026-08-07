"use client";

import { useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useDict } from "@/lib/i18n/client";

const AUTO_REFRESH_MS = 10_000;

// 验证码 5 分钟就过期，盯着这一页等码时手动刷新太累，这里定时拉最新的
export function CodeAutoRefresh() {
  const t = useDict();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = useCallback(
    () => startTransition(() => router.refresh()),
    [router],
  );

  useEffect(() => {
    const timer = setInterval(refresh, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <button
      type="button"
      onClick={refresh}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm border border-line bg-panel px-3 text-xs text-gray transition-colors duration-100 hover:border-ink hover:text-ink active:translate-y-px"
    >
      <RefreshCw
        size={12}
        aria-hidden
        className={pending ? "animate-spin" : undefined}
      />
      {pending ? t.common.refreshing : t.common.refresh}
    </button>
  );
}
