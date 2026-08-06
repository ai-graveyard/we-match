"use client";

import { useActionState, useState } from "react";
import {
  applyByCodeAction,
  applyPlazaAction,
  updateOrgAction,
  type OrgFormState,
} from "@/app/actions/orgs";
import { INVITE_CODE_LENGTH, ORG_LIMITS, VISIBILITY_LABELS } from "@/lib/orgs";
import { CodeBoxes, sanitizeCode } from "@/components/code-boxes";

const inputCls =
  "h-10 w-full rounded-sm border border-line bg-panel px-3 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink";
const labelCls = "text-[11px] font-semibold tracking-[0.08em] text-gray";
const primaryBtnCls =
  "h-10 rounded-sm bg-accent px-4 text-xs font-semibold tracking-[0.08em] text-panel transition-opacity duration-100 active:translate-y-px disabled:opacity-60";

function VisibilityPicker({
  value,
  onChange,
}: {
  value: "public" | "private";
  onChange: (v: "public" | "private") => void;
}) {
  return (
    <div>
      <div className="inline-flex overflow-hidden rounded-sm border border-line">
        {(["private", "public"] as const).map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 text-xs transition-colors duration-100 ${
              i > 0 ? "border-l border-line" : ""
            } ${value === opt ? "bg-ink font-semibold text-panel" : "text-gray hover:text-ink"}`}
          >
            {VISIBILITY_LABELS[opt]}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-gray">
        {value === "public"
          ? "公开：出现在组织广场，任何人可申请加入（需你审批）"
          : "私有：不出现在组织广场，只能凭邀请码申请"}
      </p>
      <input type="hidden" name="visibility" value={value} />
    </div>
  );
}

// 组织广场页顶：凭邀请码申请
export function ApplyByCodeForm({ initialCode }: { initialCode: string }) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    applyByCodeAction,
    {},
  );
  // URL 预填的邀请码同样过一遍过滤，防止带入非法字符
  const [code, setCode] = useState(() =>
    sanitizeCode("alphanumeric", initialCode, INVITE_CODE_LENGTH),
  );

  return (
    <form action={formAction} className="rounded-md border border-line bg-panel p-4">
      <label htmlFor="invite-code" className={`${labelCls} mb-2 block`}>
        有邀请码？输入后提交申请
      </label>
      <CodeBoxes
        length={INVITE_CODE_LENGTH}
        format="alphanumeric"
        name="code"
        id="invite-code"
        required
        value={code}
        onChange={setCode}
      />
      <button
        type="submit"
        disabled={pending || code.length < INVITE_CODE_LENGTH}
        className={`${primaryBtnCls} mt-3 w-full`}
      >
        {pending ? "提交中" : "提交申请"}
      </button>
      {state.error && <p className="mt-2 text-xs text-ink">{state.error}</p>}
      {state.ok && <p className="mt-2 text-xs text-gray">{state.ok}</p>}
    </form>
  );
}

// 组织详情页（非成员视角）：申请加入
export function ApplyPlazaButton({ orgId }: { orgId: number }) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    applyPlazaAction,
    {},
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="orgId" value={orgId} />
      <button type="submit" disabled={pending} className={`${primaryBtnCls} w-full`}>
        {pending ? "提交中" : "申请加入"}
      </button>
      {state.error && <p className="mt-2 text-xs text-ink">{state.error}</p>}
      {state.ok && <p className="mt-2 text-xs text-gray">{state.ok}</p>}
    </form>
  );
}

// 组织详情页（owner 视角）：资料编辑
export function OrgSettingsForm({
  org,
}: {
  org: {
    id: number;
    name: string;
    description: string;
    visibility: "public" | "private";
  };
}) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    updateOrgAction,
    {},
  );
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description);
  const [visibility, setVisibility] = useState(org.visibility);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="orgId" value={org.id} />
      <div>
        <label htmlFor="edit-org-name" className={`${labelCls} mb-1 block`}>
          名称
        </label>
        <input
          id="edit-org-name"
          name="name"
          className={inputCls}
          maxLength={ORG_LIMITS.name}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="edit-org-desc" className={`${labelCls} mb-1 block`}>
          简介
        </label>
        <textarea
          id="edit-org-desc"
          name="description"
          rows={3}
          className={`${inputCls} h-auto resize-y py-2`}
          maxLength={ORG_LIMITS.description}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <span className={`${labelCls} mb-1 block`}>类型</span>
        <VisibilityPicker value={visibility} onChange={setVisibility} />
      </div>
      {state.error && <p className="text-xs text-ink">{state.error}</p>}
      {state.ok && <p className="text-xs text-gray">{state.ok}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-sm border border-ink bg-panel text-xs font-semibold tracking-[0.08em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px"
      >
        {pending ? "保存中" : "保存资料"}
      </button>
    </form>
  );
}
