"use client";

import { useActionState, useState } from "react";
import {
  createOrgAction,
  type OrgFormState,
} from "@/app/actions/orgs";
import { ORG_LIMITS, VISIBILITY_LABELS } from "@/lib/orgs";

const inputCls =
  "h-10 w-full rounded-sm border border-line bg-panel px-3 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink";
const labelCls = "text-[11px] font-semibold tracking-[0.08em] text-gray";

export function CreateOrgForm() {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    createOrgAction,
    {},
  );
  const [visibility, setVisibility] = useState<"public" | "private">("private");

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-md border border-line bg-panel p-4"
    >
      <div>
        <label htmlFor="org-name" className={`${labelCls} mb-1 block`}>
          名称（必填，≤ {ORG_LIMITS.name} 字）
        </label>
        <input
          id="org-name"
          name="name"
          className={inputCls}
          maxLength={ORG_LIMITS.name}
          required
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="org-desc" className={`${labelCls} mb-1 block`}>
          简介
        </label>
        <textarea
          id="org-desc"
          name="description"
          rows={4}
          className={`${inputCls} h-auto resize-y py-2`}
          maxLength={ORG_LIMITS.description}
        />
      </div>

      <div>
        <span className={`${labelCls} mb-1 block`}>类型</span>
        <div className="inline-flex overflow-hidden rounded-sm border border-line">
          {(["private", "public"] as const).map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => setVisibility(option)}
              className={`px-3 py-1.5 text-xs transition-colors duration-100 ${
                index > 0 ? "border-l border-line" : ""
              } ${
                visibility === option
                  ? "bg-ink font-semibold text-panel"
                  : "text-gray hover:text-ink"
              }`}
            >
              {VISIBILITY_LABELS[option]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-gray">
          {visibility === "public"
            ? "公开：出现在组织广场，任何人可申请加入（需你审批）"
            : "私有：不出现在组织广场，只能凭邀请码申请"}
        </p>
        <input type="hidden" name="visibility" value={visibility} />
      </div>

      {state.error && <p className="text-xs text-ink">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-sm bg-accent px-4 text-xs font-semibold tracking-[0.08em] text-panel transition-opacity duration-100 active:translate-y-px disabled:opacity-60"
      >
        {pending ? "保存中" : "保存"}
      </button>
    </form>
  );
}
