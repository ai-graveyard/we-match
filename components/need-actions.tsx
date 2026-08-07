"use client";

import { useState } from "react";
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
} from "@/app/actions/needs";
import { useDict } from "@/lib/i18n/client";
import { LocaleLink } from "@/lib/i18n/link";

const btnCls =
  "inline-flex h-11 items-center justify-center gap-1 rounded-sm border border-ink bg-panel px-3 text-sm font-semibold tracking-[0.06em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px";

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {expired && (
        <form action={refreshNeedAction}>
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
          <form action={setNeedStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="done" />
            <button type="submit" className={btnCls}>
              <Check size={12} aria-hidden />
              {t.need.actionMarkDone}
            </button>
          </form>
          <form action={setNeedStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="closed" />
            <button type="submit" className={btnCls}>
              <CircleX size={12} aria-hidden />
              {t.need.actionClose}
            </button>
          </form>
        </>
      ) : (
        <form action={setNeedStatusAction}>
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
            className="text-2xs text-gray hover:text-ink"
            onClick={() => setConfirming(false)}
          >
            {t.common.cancel}
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-2xs text-gray hover:text-ink"
          onClick={() => setConfirming(true)}
        >
          <Trash2 size={12} aria-hidden />
          {t.common.delete}
        </button>
      )}
    </div>
  );
}
