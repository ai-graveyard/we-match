"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useDict } from "@/lib/i18n/client";

export function LogoutConfirmation() {
  const t = useDict();
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
        {t.account.logout}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={t.account.logoutConfirmLabel}
      onKeyDown={(event) => {
        if (event.key === "Escape") setConfirming(false);
      }}
      className="rounded-md border border-line bg-panel p-3"
    >
      <p className="text-sm font-semibold">{t.account.logoutConfirmTitle}</p>
      <p className="mt-1 text-xs text-gray">{t.account.logoutConfirmBody}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={() => setConfirming(false)}
          className="h-11 rounded-sm border border-line text-sm font-semibold tracking-[0.06em] text-gray transition-colors duration-100 hover:border-ink hover:text-ink active:translate-y-px"
        >
          {t.common.cancel}
        </button>
        <button
          type="submit"
          className="flex h-11 items-center justify-center gap-1.5 rounded-sm bg-ink text-sm font-semibold tracking-[0.06em] text-panel active:translate-y-px"
        >
          <LogOut size={13} aria-hidden />
          {t.account.logoutConfirm}
        </button>
      </div>
    </div>
  );
}
