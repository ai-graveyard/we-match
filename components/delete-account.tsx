"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { UserRoundX } from "lucide-react";
import {
  deleteAccountAction,
  type DeleteAccountState,
} from "@/app/actions/auth";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/fmt";

// 设置里的「注销账号」行：展开两步确认后提交。
// ownedOrgNames 非空时禁用提交，提示先解散组织（服务端会再校验一次）。
export function DeleteAccountRow({
  ownedOrgNames,
}: {
  ownedOrgNames: string[];
}) {
  const t = useDict();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<
    DeleteAccountState,
    FormData
  >(deleteAccountAction, {});
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex min-h-16 w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-100 hover:bg-bg-3 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-ink"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            {t.account.deleteTitle}
          </span>
          <span className="mt-0.5 block text-xs text-gray">
            {t.account.deleteHint}
          </span>
        </span>
        <UserRoundX size={15} className="shrink-0 text-gray" aria-hidden />
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={t.account.deleteConfirmLabel}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) setConfirming(false);
      }}
      className="p-4"
    >
      <p className="text-sm font-semibold">{t.account.deleteConfirmTitle}</p>
      <ul className="mt-2 space-y-1 text-xs text-gray">
        <li>{t.account.deleteBullet1}</li>
        <li>{t.account.deleteBullet2}</li>
        <li>{t.account.deleteBullet3}</li>
        <li>{t.account.deleteBullet4}</li>
      </ul>
      {ownedOrgNames.length > 0 && (
        <p className="mt-3 rounded-sm bg-bg-3 px-3 py-2 text-xs text-gray">
          {fmt(t.account.deleteOwnedOrgs, { orgs: ownedOrgNames.join("、") })}
        </p>
      )}
      {state.error && (
        <p role="alert" className="mt-3 text-xs font-semibold text-ink">
          {state.error}
        </p>
      )}
      <form action={formAction} className="mt-3 grid grid-cols-2 gap-2">
        <button
          ref={cancelRef}
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="h-11 rounded-sm border border-line text-sm font-semibold tracking-[0.06em] text-gray transition-colors duration-100 hover:border-ink hover:text-ink active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
        >
          {t.common.cancel}
        </button>
        <button
          type="submit"
          disabled={pending || ownedOrgNames.length > 0}
          className="flex h-11 items-center justify-center gap-1.5 rounded-sm bg-ink text-sm font-semibold tracking-[0.06em] text-panel active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
        >
          <UserRoundX size={13} aria-hidden />
          {pending ? t.account.deleting : t.account.deleteConfirm}
        </button>
      </form>
    </div>
  );
}
