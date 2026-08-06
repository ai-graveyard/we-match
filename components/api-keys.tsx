"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import {
  createApiKeyAction,
  deleteApiKeyAction,
  type ApiKeyFormState,
} from "@/app/actions/api-keys";
import { CopyButton } from "@/components/copy-button";

const inputCls =
  "h-10 w-full rounded-sm border border-line bg-panel px-3 text-sm outline-none transition-colors duration-100 placeholder:text-gray focus:border-ink";
const labelCls = "text-[11px] font-semibold tracking-[0.08em] text-gray";
const primaryBtnCls =
  "h-10 rounded-sm bg-accent px-4 text-xs font-semibold tracking-[0.08em] text-panel transition-opacity duration-100 active:translate-y-px disabled:opacity-60";

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
              className="inline-flex items-center gap-1 rounded-sm border border-ink px-2 py-1 text-[11px] font-semibold tracking-[0.08em] text-ink transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px"
            >
              <Trash2 size={11} aria-hidden />
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
            className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] text-gray hover:text-ink"
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={11} aria-hidden />
            删除
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-gray">
          {masked}
        </code>
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-gray">{meta}</p>
      {confirming && (
        <p className="mt-1.5 text-[11px] text-gray">
          删除后此 Key 立即失效，正在使用它的 Agent 将无法访问
        </p>
      )}
    </div>
  );
}

// 折叠的生成表单；满额时由父组件传 atLimit 禁用
export function CreateApiKeyForm({ atLimit }: { atLimit: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ApiKeyFormState, FormData>(
    createApiKeyAction,
    {},
  );

  if (atLimit) {
    return (
      <p className="p-4 text-xs text-gray">
        已达 3 个 Key 上限，删除不用的 Key 后可再生成
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
        生成新 API Key
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
              名称（必填，≤ 20 字）
            </label>
            <input
              id="key-name"
              name="name"
              className={inputCls}
              placeholder="如「我的 Claude」"
              maxLength={20}
              required
            />
          </div>
          <p className="text-[11px] text-gray">
            Key 默认拥有完整读写权限。出于安全考虑，明文只显示一次
          </p>
          {state.error && <p className="text-xs text-ink">{state.error}</p>}
          {state.createdKey && (
            <div className="rounded-sm border border-accent bg-bg p-3">
              <p className="text-[11px] font-semibold text-accent">
                请立即复制，此 Key 只显示一次
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[11px]">
                  {state.createdKey}
                </code>
                <CopyButton text={state.createdKey} />
              </div>
            </div>
          )}
          <button type="submit" disabled={pending} className={primaryBtnCls}>
            {pending ? "生成中" : state.createdKey ? "再生成一个" : "生成"}
          </button>
        </form>
      )}
    </div>
  );
}
