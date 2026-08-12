"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useDict } from "@/lib/i18n/client";
import { inkBtn, panel, quietBtn, secondaryBtn } from "@/lib/ui";

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
        className={`${secondaryBtn} w-full`}
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
      className={`${panel} p-3`}
    >
      <p className="text-sm font-semibold">{t.account.logoutConfirmTitle}</p>
      <p className="mt-1 text-xs text-gray">{t.account.logoutConfirmBody}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={() => setConfirming(false)}
          className={quietBtn}
        >
          {t.common.cancel}
        </button>
        <button
          type="submit"
          className={inkBtn}
        >
          <LogOut size={13} aria-hidden />
          {t.account.logoutConfirm}
        </button>
      </div>
    </div>
  );
}
