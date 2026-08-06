"use client";

import { useActionState, useState } from "react";
import {
  blockUserAction,
  reportContentAction,
  unblockUserAction,
  type ReportFormState,
} from "@/app/actions/safety";

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
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ReportFormState, FormData>(
    reportContentAction,
    {},
  );

  return (
    <section className="mt-6 border-t border-line pt-4">
      <div className="flex items-center gap-4 text-[11px] text-gray">
        <button type="button" onClick={() => setOpen(!open)} className="underline">
          举报{targetType === "need" ? "这条需求" : "该用户"}
        </button>
        {canBlock && (
          <form action={blocked ? unblockUserAction : blockUserAction}>
            <input type="hidden" name="targetId" value={targetId} />
            <button className="underline">{blocked ? "解除拉黑" : "拉黑该用户"}</button>
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
            className="h-10 w-full rounded-sm border border-line bg-bg px-3 text-sm"
          >
            <option value="" disabled>选择原因</option>
            <option value="spam">垃圾广告</option>
            <option value="fraud">欺诈或虚假信息</option>
            <option value="harassment">骚扰或攻击</option>
            <option value="illegal">违法违规</option>
            <option value="other">其他</option>
          </select>
          <textarea
            name="details"
            maxLength={500}
            rows={3}
            placeholder="可补充具体情况"
            className="mt-2 w-full resize-none rounded-sm border border-line bg-bg px-3 py-2 text-sm"
          />
          {state.error && <p className="mt-2 text-xs text-accent">{state.error}</p>}
          {state.ok && <p className="mt-2 text-xs text-gray">{state.ok}</p>}
          <button
            type="submit"
            disabled={pending || !!state.ok}
            className="mt-2 h-9 rounded-sm border border-ink px-3 text-[11px] font-semibold disabled:opacity-60"
          >
            {pending ? "提交中" : "提交举报"}
          </button>
        </form>
      )}
    </section>
  );
}
