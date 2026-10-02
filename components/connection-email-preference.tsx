"use client";
import { useActionState } from "react";
import { setConnectionEmailAction } from "@/app/actions/preferences";
import { useDict } from "@/lib/i18n/client";
import { fieldError, secondaryBtn, settingsRow } from "@/lib/ui";

export function ConnectionEmailPreference({ enabled, available }: { enabled: boolean; available: boolean }) {
  const t = useDict();
  const [state, action, pending] = useActionState(setConnectionEmailAction, {});
  return <form action={action} className={`${settingsRow} border-t border-line`}>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold">{t.me.emailNotifications}</p>
      <p className="mt-1 text-2xs leading-relaxed text-gray">{available ? t.me.emailNotificationsHint : t.me.emailNotificationsUnavailable}</p>
      {state.error && <p className={fieldError}>{state.error}</p>}
    </div>
    <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
    <button type="submit" role="switch" aria-checked={enabled} aria-label={t.me.emailNotifications} disabled={pending} className={`${secondaryBtn} shrink-0 disabled:opacity-60`}>{enabled ? t.common.on : t.common.off}</button>
  </form>;
}
