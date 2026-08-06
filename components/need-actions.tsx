"use client";

import { useState } from "react";
import Link from "next/link";
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

const btnCls =
  "inline-flex h-8 items-center justify-center gap-1 rounded-sm border border-ink bg-panel px-3 text-[11px] font-semibold tracking-[0.08em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px";

export function NeedActions({
  id,
  status,
  expired,
}: {
  id: number;
  status: "open" | "done" | "closed";
  expired: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {expired && (
        <form action={refreshNeedAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={btnCls}>
            <RefreshCw size={12} aria-hidden />
            续期一个月
          </button>
        </form>
      )}
      <Link href={`/needs/new?id=${id}`} className={btnCls}>
        <Pencil size={12} aria-hidden />
        编辑
      </Link>
      {status === "open" ? (
        <>
          <form action={setNeedStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="done" />
            <button type="submit" className={btnCls}>
              <Check size={12} aria-hidden />
              标记已完成
            </button>
          </form>
          <form action={setNeedStatusAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="closed" />
            <button type="submit" className={btnCls}>
              <CircleX size={12} aria-hidden />
              关闭
            </button>
          </form>
        </>
      ) : (
        <form action={setNeedStatusAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="status" value="open" />
          <button type="submit" className={btnCls}>
            <RotateCcw size={12} aria-hidden />
            重新开放
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
            确认删除
          </button>
          <button
            type="button"
            className="text-[11px] text-gray hover:text-ink"
            onClick={() => setConfirming(false)}
          >
            取消
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] text-gray hover:text-ink"
          onClick={() => setConfirming(true)}
        >
          <Trash2 size={12} aria-hidden />
          删除
        </button>
      )}
    </div>
  );
}
