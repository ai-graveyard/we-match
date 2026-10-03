"use client";
import { useActionState, useTransition } from "react";
import { setConnectionEmailAction } from "@/app/actions/preferences";
import { useDict } from "@/lib/i18n/client";
import { Switch } from "@/components/ui/switch";
import { fieldError, settingsRow } from "@/lib/ui";

export function ConnectionEmailPreference({ enabled, available }: { enabled: boolean; available: boolean }) {
  const t = useDict();
  const [state, action, pending] = useActionState(setConnectionEmailAction, {});
  const [transitioning, startTransition] = useTransition();
  return <div className={`${settingsRow} border-t border-line`}>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold">{t.me.emailNotifications}</p>
      <p className="mt-1 text-2xs leading-relaxed text-gray">{available ? t.me.emailNotificationsHint : t.me.emailNotificationsUnavailable}</p>
      {state.error && <p className={fieldError}>{state.error}</p>}
    </div>
    <Switch checked={enabled} aria-label={t.me.emailNotifications} disabled={pending || transitioning}
      onCheckedChange={(checked) => {
        const data = new FormData(); data.set("enabled", checked ? "1" : "0");
        startTransition(() => action(data));
      }} />
  </div>;
}
