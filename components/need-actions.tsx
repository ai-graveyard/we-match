"use client";

import { Button } from "@/components/ui/button";

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
            <Button variant="plain" size="plain" type="submit" className={btnCls}>
              <RefreshCw size={12} aria-hidden />
              {t.need.actionRenew}
            </Button>
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
              <Button variant="plain" size="plain" type="submit" className={btnCls}>
                <Check size={12} aria-hidden />
                {t.need.actionMarkDone}
              </Button>
            </form>
            <form action={statusAction}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="closed" />
              <Button variant="plain" size="plain" type="submit" className={btnCls}>
                <CircleX size={12} aria-hidden />
                {t.need.actionClose}
              </Button>
            </form>
          </>
        ) : (
          <form action={statusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="open" />
            <Button variant="plain" size="plain" type="submit" className={btnCls}>
              <RotateCcw size={12} aria-hidden />
              {t.need.actionReopen}
            </Button>
          </form>
        )}
        {confirming ? (
          <form action={deleteNeedAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={id} />
            <Button variant="plain" size="plain"
              type="submit"
              className={btnCls}
            >
              <Trash2 size={12} aria-hidden />
              {t.common.confirmDelete}
            </Button>
            <Button variant="plain" size="plain"
              type="button"
              className={textBtn}
              onClick={() => setConfirming(false)}
            >
              {t.common.cancel}
            </Button>
          </form>
        ) : (
          <Button variant="plain" size="plain"
            type="button"
            className={textBtn}
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={12} aria-hidden />
            {t.common.delete}
          </Button>
        )}
      </div>
      {error && <p className={fieldError}>{error}</p>}
    </div>
  );
}
