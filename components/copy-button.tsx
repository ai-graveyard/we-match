"use client";

import { Button } from "@/components/ui/button";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { useDict } from "@/lib/i18n/client";

// http 环境（如局域网 IP 访问）没有 navigator.clipboard，退化到 execCommand
function legacyCopy(text: string): boolean {
  const previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  ta.tabIndex = -1;
  ta.setAttribute("aria-hidden", "true");
  // 弹窗内复制时，临时输入框也必须留在焦点边界内。
  (previousFocus?.closest('[role="dialog"]') ?? document.body).appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  previousFocus?.focus({ preventScroll: true });
  return ok;
}

export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 权限被拒等场景，继续走兜底
    }
  }
  return legacyCopy(text);
}

// text 可传函数（点击时求值），用于依赖 location 等仅客户端可用的值
export function CopyButton({
  text,
  label,
  accent = false,
}: {
  text: string | (() => string);
  /** 不传就是通用的「复制」 */
  label?: string;
  accent?: boolean;
}) {
  const t = useDict();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <Button variant="plain" size="plain"
      type="button"
      className={`flex h-11 shrink-0 items-center gap-1 rounded-sm px-2 text-sm font-semibold tracking-[0.06em] transition-colors duration-100 active:translate-y-px ${
        state === "idle"
          ? accent
            ? "text-accent"
            : "text-gray hover:text-ink"
          : "text-gray"
      }`}
      onClick={async () => {
        const ok = await copyText(typeof text === "function" ? text() : text);
        setState(ok ? "copied" : "failed");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 2000);
      }}
    >
      {state === "copied" ? (
        <Check size={12} aria-hidden />
      ) : (
        <Copy size={12} aria-hidden />
      )}
      {state === "idle"
        ? (label ?? t.common.copy)
        : state === "copied"
          ? t.common.copied
          : t.common.copyFailed}
    </Button>
  );
}
