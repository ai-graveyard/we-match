"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";

export function LogoutConfirmation() {
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-sm border border-ink bg-panel text-sm font-semibold tracking-[0.06em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px"
      >
        <LogOut size={13} aria-hidden />
        退出登录
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="确认退出登录"
      onKeyDown={(event) => {
        if (event.key === "Escape") setConfirming(false);
      }}
      className="rounded-md border border-line bg-panel p-3"
    >
      <p className="text-sm font-semibold">确认退出当前账号？</p>
      <p className="mt-1 text-xs text-gray">退出后需要重新验证手机号登录。</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={() => setConfirming(false)}
          className="h-11 rounded-sm border border-line text-sm font-semibold tracking-[0.06em] text-gray transition-colors duration-100 hover:border-ink hover:text-ink active:translate-y-px"
        >
          取消
        </button>
        <button
          type="submit"
          className="flex h-11 items-center justify-center gap-1.5 rounded-sm bg-ink text-sm font-semibold tracking-[0.06em] text-panel active:translate-y-px"
        >
          <LogOut size={13} aria-hidden />
          确认退出
        </button>
      </div>
    </div>
  );
}
