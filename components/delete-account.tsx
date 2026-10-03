"use client";

import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import { useActionState, useState } from "react";
import { UserRoundX } from "lucide-react";
import {
  deleteAccountAction,
  type DeleteAccountState,
} from "@/app/actions/auth";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/fmt";
import {
  fieldError,
  inkBtn,
  quietBtn,
  settingsRowInteractive,
} from "@/lib/ui";

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
  return (
    <AlertDialog open={confirming} onOpenChange={(open) => { if (!pending) setConfirming(open); }}>
      <AlertDialogTrigger asChild>
      <Button variant="plain" size="plain"
        type="button"
        onClick={() => setConfirming(true)}
        className={settingsRowInteractive}
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
      </Button>
      </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogTitle>{t.account.deleteConfirmTitle}</AlertDialogTitle>
      <AlertDialogDescription>{t.account.deleteHint}</AlertDialogDescription>
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
        <p role="alert" className={`mt-3 ${fieldError}`}>
          {state.error}
        </p>
      )}
      <form action={formAction} className="mt-3 grid grid-cols-2 gap-2">
        <AlertDialogCancel disabled={pending} className={quietBtn}>{t.common.cancel}</AlertDialogCancel>
        <Button variant="plain" size="plain"
          type="submit"
          disabled={pending || ownedOrgNames.length > 0}
          className={inkBtn}
        >
          <UserRoundX size={13} aria-hidden />
          {pending ? t.account.deleting : t.account.deleteConfirm}
        </Button>
      </form>
    </AlertDialogContent>
    </AlertDialog>
  );
}
