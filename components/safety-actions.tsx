"use client";

import { FormSelect } from "@/components/ui/form-select";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { useActionState, useState } from "react";
import {
  blockUserAction,
  reportContentAction,
  unblockUserAction,
  type ReportFormState,
} from "@/app/actions/safety";
import { useDict } from "@/lib/i18n/client";
import {
  fieldError,
  panel,
  secondaryBtn,
} from "@/lib/ui";

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
        <Button variant="plain" size="plain" type="button" onClick={() => setOpen(!open)} className="underline">
          {targetType === "need" ? t.safety.reportNeed : t.safety.reportUser}
        </Button>
        {canBlock && (
          <form action={blocked ? unblockUserAction : blockUserAction}>
            <input type="hidden" name="targetId" value={targetId} />
            <Button variant="plain" size="plain" className="underline">
              {blocked ? t.safety.unblock : t.safety.block}
            </Button>
          </form>
        )}
      </div>
      {open && (
        <form action={action} className={`mt-3 ${panel} p-3`}>
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <FormSelect name="reason" required label={t.safety.reasonPlaceholder}
            placeholder={t.safety.reasonPlaceholder} className="h-11 w-full bg-bg text-sm"
            options={[
              { value: "spam", label: t.safety.reasonSpam },
              { value: "fraud", label: t.safety.reasonFraud },
              { value: "harassment", label: t.safety.reasonHarassment },
              { value: "illegal", label: t.safety.reasonIllegal },
              { value: "other", label: t.safety.reasonOther },
            ]}
          />
          <Textarea
            name="details"
            maxLength={500}
            rows={3}
            placeholder={t.safety.detailsPlaceholder}
            className="mt-2 w-full resize-none rounded-sm border border-line bg-bg px-3 py-2 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink"
          />
          {state.error && <p className={`mt-2 ${fieldError}`}>{state.error}</p>}
          {state.ok && <p className="mt-2 text-xs text-gray">{state.ok}</p>}
          <Button variant="plain" size="plain"
            type="submit"
            disabled={pending || !!state.ok}
            className={`${secondaryBtn} mt-2 disabled:opacity-60`}
          >
            {pending ? t.common.submitting : t.safety.submitReport}
          </Button>
        </form>
      )}
    </section>
  );
}
