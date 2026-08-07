"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import {
  createApiKeyAction,
  deleteApiKeyAction,
  type ApiKeyFormState,
} from "@/app/actions/api-keys";
import { CopyButton } from "@/components/copy-button";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/fmt";
import { API_KEY_LIMITS } from "@/lib/api-keys";

const inputCls =
  "h-11 w-full rounded-sm border border-line bg-panel px-3 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink";
const labelCls = "text-2xs font-semibold tracking-[0.08em] text-gray";
const primaryBtnCls =
  "h-11 rounded-sm bg-accent px-4 text-sm font-semibold tracking-[0.06em] text-panel transition-opacity duration-100 active:translate-y-px disabled:opacity-60";

// Key 列表只显示末四位；明文仅在创建成功时显示一次。
export function ApiKeyRow({
  id,
  name,
  masked,
  meta,
  first,
}: {
  id: number;
  name: string;
  masked: string;
  meta: string;
  first: boolean;
}) {
  const t = useDict();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={`p-4 ${first ? "" : "border-t border-line"}`}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate font-semibold">{name}</span>
        {confirming ? (
          <form
            action={deleteApiKeyAction}
            className="ml-auto flex shrink-0 items-center gap-2"
          >
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-sm border border-ink px-2 py-2 text-sm font-semibold tracking-[0.06em] text-ink transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px"
            >
              <Trash2 size={11} aria-hidden />
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
            className="ml-auto inline-flex shrink-0 items-center gap-1 text-2xs text-gray hover:text-ink"
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={11} aria-hidden />
            {t.common.delete}
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <code className="min-w-0 flex-1 break-all font-mono text-2xs text-gray">
          {masked}
        </code>
      </div>
      <p className="mt-1.5 font-mono text-2xs text-gray">{meta}</p>
      {confirming && (
        <p className="mt-1.5 text-2xs text-gray">{t.agent.keyDeleteHint}</p>
      )}
    </div>
  );
}

// 折叠的生成表单；满额时由父组件传 atLimit 禁用
export function CreateApiKeyForm({ atLimit }: { atLimit: boolean }) {
  const t = useDict();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ApiKeyFormState, FormData>(
    createApiKeyAction,
    {},
  );

  if (atLimit) {
    return (
      <p className="p-4 text-xs text-gray">
        {fmt(t.agent.keyAtLimit, { max: API_KEY_LIMITS.perUser })}
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-12 w-full items-center justify-between px-4 text-sm transition-colors duration-100 hover:bg-bg-3"
      >
        {t.agent.keyCreateToggle}
        {open ? (
          <ChevronUp size={15} className="text-gray" aria-hidden />
        ) : (
          <ChevronDown size={15} className="text-gray" aria-hidden />
        )}
      </button>
      {open && (
        <form
          action={formAction}
          className="flex flex-col gap-3 border-t border-line p-4"
        >
          <div>
            <label htmlFor="key-name" className={`${labelCls} mb-1 block`}>
              {fmt(t.agent.keyNameLabel, { max: API_KEY_LIMITS.name })}
            </label>
            <input
              id="key-name"
              name="name"
              className={inputCls}
              placeholder={t.agent.keyNamePlaceholder}
              maxLength={API_KEY_LIMITS.name}
              required
            />
          </div>
          <p className="text-2xs text-gray">{t.agent.keyScopeHint}</p>
          {state.error && <p className="text-xs text-ink">{state.error}</p>}
          {state.createdKey && (
            <div className="rounded-sm border border-accent bg-bg p-3">
              <p className="text-2xs font-semibold text-accent">
                {t.agent.keyCreatedWarning}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-2xs">
                  {state.createdKey}
                </code>
                <CopyButton text={state.createdKey} />
              </div>
            </div>
          )}
          <button type="submit" disabled={pending} className={primaryBtnCls}>
            {pending
              ? t.agent.keyGenerating
              : state.createdKey
                ? t.agent.keyGenerateAnother
                : t.agent.keyGenerate}
          </button>
        </form>
      )}
    </div>
  );
}
