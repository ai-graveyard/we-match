"use client";

import { useActionState, useState } from "react";
import {
  applyByCodeAction,
  applyPlazaAction,
  updateOrgAction,
  type OrgFormState,
} from "@/app/actions/orgs";
import { INVITE_CODE_LENGTH, ORG_LIMITS } from "@/lib/orgs";
import { CodeBoxes, sanitizeCode } from "@/components/code-boxes";
import { useDict } from "@/lib/i18n/client";
import { orgVisibilityLabel } from "@/lib/i18n/labels";
import {
  fieldError,
  input as inputCls,
  panel,
  primaryBtn,
  secondaryBtn,
  sectionLabel as labelCls,
  segmentGroup,
  segmentItem,
  textarea as textareaCls,
} from "@/lib/ui";

/** 组织可见性三选一。创建页和设置页共用，两边各写一份必然漂移 */
export function VisibilityPicker({
  value,
  onChange,
}: {
  value: "public" | "private";
  onChange: (v: "public" | "private") => void;
}) {
  const t = useDict();
  return (
    <div>
      <div className={segmentGroup}>
        {(["private", "public"] as const).map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={segmentItem(value === opt, i === 0)}
          >
            {orgVisibilityLabel(t, opt)}
          </button>
        ))}
      </div>
      <p className="mt-1 text-2xs text-gray">
        {value === "public" ? t.org.formPublicHint : t.org.formPrivateHint}
      </p>
      <input type="hidden" name="visibility" value={value} />
    </div>
  );
}

// 组织广场页顶：凭邀请码申请
export function ApplyByCodeForm({ initialCode }: { initialCode: string }) {
  const t = useDict();
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    applyByCodeAction,
    {},
  );
  // URL 预填的邀请码同样过一遍过滤，防止带入非法字符
  const [code, setCode] = useState(() =>
    sanitizeCode("alphanumeric", initialCode, INVITE_CODE_LENGTH),
  );

  return (
    <form action={formAction} className={`${panel} p-4`}>
      <label htmlFor="invite-code" className={`${labelCls} mb-2 block`}>
        {t.org.codeFormLabel}
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
        className={`${primaryBtn} mt-3 w-full`}
      >
        {pending ? t.common.submitting : t.org.codeFormSubmit}
      </button>
      {state.error && <p className={`mt-2 ${fieldError}`}>{state.error}</p>}
      {state.ok && <p className="mt-2 text-xs text-gray">{state.ok}</p>}
    </form>
  );
}

// 组织详情页（非成员视角）：申请加入
export function ApplyPlazaButton({ orgId }: { orgId: number }) {
  const t = useDict();
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    applyPlazaAction,
    {},
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="orgId" value={orgId} />
      <button type="submit" disabled={pending} className={`${primaryBtn} w-full`}>
        {pending ? t.common.submitting : t.org.applyJoin}
      </button>
      {state.error && <p className={`mt-2 ${fieldError}`}>{state.error}</p>}
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
  const t = useDict();
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
          {t.org.formName}
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
          {t.org.formDescription}
        </label>
        <textarea
          id="edit-org-desc"
          name="description"
          rows={3}
          className={textareaCls}
          maxLength={ORG_LIMITS.description}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <span className={`${labelCls} mb-1 block`}>{t.org.formType}</span>
        <VisibilityPicker value={visibility} onChange={setVisibility} />
      </div>
      {state.error && <p className={fieldError}>{state.error}</p>}
      {state.ok && <p className="text-xs text-gray">{state.ok}</p>}
      <button type="submit" disabled={pending} className={secondaryBtn}>
        {pending ? t.common.saving : t.org.formSaveProfile}
      </button>
    </form>
  );
}
