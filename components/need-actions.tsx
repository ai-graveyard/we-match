"use client";

import { useActionState, useState } from "react";
import {
  Check,
  CircleX,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  deleteNeedAction,
  refreshNeedAction,
  setNeedStatusAction,
  type NeedFormState,
} from "@/app/actions/needs";
import { useDict } from "@/lib/i18n/client";
import { LocaleLink } from "@/lib/i18n/link";
import { fieldError, secondaryBtn, textBtn } from "@/lib/ui";

const btnCls = secondaryBtn;

export function NeedActions({
  id,
  status,
  expired,
}: {
  id: number;
  status: "open" | "done" | "closed";
  expired: boolean;
}) {
  const t = useDict();
  const [confirming, setConfirming] = useState(false);
  const [renewState, renewAction] = useActionState<NeedFormState, FormData>(
    refreshNeedAction,
    {},
  );
  const [statusState, statusAction] = useActionState<NeedFormState, FormData>(
    setNeedStatusAction,
    {},
  );
  const error = renewState.error ?? statusState.error;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {expired && (
          <form action={renewAction}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className={btnCls}>
              <RefreshCw size={12} aria-hidden />
              {t.need.actionRenew}
            </button>
          </form>
        )}
        <LocaleLink href={`/needs/new?id=${id}`} className={btnCls}>
          <Pencil size={12} aria-hidden />
          {t.common.edit}
        </LocaleLink>
        {status === "open" ? (
          <>
            <form action={statusAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="done" />
              <button type="submit" className={btnCls}>
                <Check size={12} aria-hidden />
                {t.need.actionMarkDone}
              </button>
            </form>
            <form action={statusAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="closed" />
              <button type="submit" className={btnCls}>
                <CircleX size={12} aria-hidden />
                {t.need.actionClose}
              </button>
            </form>
          </>
        ) : (
          <form action={statusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="open" />
            <button type="submit" className={btnCls}>
              <RotateCcw size={12} aria-hidden />
              {t.need.actionReopen}
            </button>
          </form>
        )}
        {confirming ? (
          <form action={deleteNeedAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className={btnCls}
            >
              <Trash2 size={12} aria-hidden />
              {t.common.confirmDelete}
            </button>
            <button
              type="button"
              className={textBtn}
              onClick={() => setConfirming(false)}
            >
              {t.common.cancel}
            </button>
          </form>
        ) : (
          <button
            type="button"
            className={textBtn}
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={12} aria-hidden />
            {t.common.delete}
          </button>
        )}
      </div>
      {error && <p className={fieldError}>{error}</p>}
    </div>
  );
}
