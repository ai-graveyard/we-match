"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

// http 环境（如局域网 IP 访问）没有 navigator.clipboard，退化到 execCommand
function legacyCopy(text: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
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
  label = "复制",
  accent = false,
}: {
  text: string | (() => string);
  label?: string;
  accent?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <button
      type="button"
      className={`flex shrink-0 items-center gap-1 rounded-sm px-2 py-2 text-sm font-semibold tracking-[0.06em] transition-colors duration-100 active:translate-y-px ${
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
      {state === "idle" ? label : state === "copied" ? "已复制" : "复制失败"}
    </button>
  );
}
