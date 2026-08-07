"use client";

import { useActionState, useState } from "react";
import {
  blockUserAction,
  reportContentAction,
  unblockUserAction,
  type ReportFormState,
} from "@/app/actions/safety";
import { useDict } from "@/lib/i18n/client";

export function SafetyActions({
  targetType,
  targetId,
  canBlock = false,
  blocked = false,
}: {
  targetType: "user" | "need";
  targetId: number;
  canBlock?: boolean;
  blocked?: boolean;
}) {
  const t = useDict();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ReportFormState, FormData>(
    reportContentAction,
    {},
  );

  return (
    <section className="mt-6 border-t border-line pt-4">
      <div className="flex items-center gap-4 text-2xs text-gray">
        <button type="button" onClick={() => setOpen(!open)} className="underline">
          {targetType === "need" ? t.safety.reportNeed : t.safety.reportUser}
        </button>
        {canBlock && (
          <form action={blocked ? unblockUserAction : blockUserAction}>
            <input type="hidden" name="targetId" value={targetId} />
            <button className="underline">
              {blocked ? t.safety.unblock : t.safety.block}
            </button>
          </form>
        )}
      </div>
      {open && (
        <form action={action} className="mt-3 rounded-md border border-line bg-panel p-3">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <select
            name="reason"
            required
            defaultValue=""
            className="h-11 w-full rounded-sm border border-line bg-bg px-3 text-sm"
          >
            <option value="" disabled>
              {t.safety.reasonPlaceholder}
            </option>
            <option value="spam">{t.safety.reasonSpam}</option>
            <option value="fraud">{t.safety.reasonFraud}</option>
            <option value="harassment">{t.safety.reasonHarassment}</option>
            <option value="illegal">{t.safety.reasonIllegal}</option>
            <option value="other">{t.safety.reasonOther}</option>
          </select>
          <textarea
            name="details"
            maxLength={500}
            rows={3}
            placeholder={t.safety.detailsPlaceholder}
            className="mt-2 w-full resize-none rounded-sm border border-line bg-bg px-3 py-2 text-sm"
          />
          {state.error && <p className="mt-2 text-xs text-accent">{state.error}</p>}
          {state.ok && <p className="mt-2 text-xs text-gray">{state.ok}</p>}
          <button
            type="submit"
            disabled={pending || !!state.ok}
            className="mt-2 h-11 rounded-sm border border-ink bg-panel px-3 text-sm font-semibold tracking-[0.06em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px disabled:opacity-60"
          >
            {pending ? t.common.submitting : t.safety.submitReport}
          </button>
        </form>
      )}
    </section>
  );
}
