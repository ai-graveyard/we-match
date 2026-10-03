"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { logoutAction } from "@/app/actions/auth";
import { useDict } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel } from "@/components/ui/alert-dialog";

function LogoutSubmit() {
  const { pending } = useFormStatus();
  const t = useDict();
  return <Button type="submit" variant="destructive" disabled={pending} className="w-full"><LogOut size={13} aria-hidden />{t.account.logoutConfirm}</Button>;
}
export function LogoutConfirmation() {
  const t = useDict();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button type="button" variant="outline" className="w-full"><LogOut size={13} aria-hidden />{t.account.logout}</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{t.account.logoutConfirmTitle}</AlertDialogTitle>
        <AlertDialogDescription>{t.account.logoutConfirmBody}</AlertDialogDescription>
        <div className="grid grid-cols-2 gap-2">
          <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
          <form action={logoutAction}><LogoutSubmit /></form>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
