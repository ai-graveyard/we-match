"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { UserRoundX } from "lucide-react";
import {
  deleteAccountAction,
  type DeleteAccountState,
} from "@/app/actions/auth";

// 设置里的「注销账号」行：展开两步确认后提交。
// ownedOrgNames 非空时禁用提交，提示先解散组织（服务端会再校验一次）。
export function DeleteAccountRow({
  ownedOrgNames,
}: {
  ownedOrgNames: string[];
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<
    DeleteAccountState,
    FormData
  >(deleteAccountAction, {});
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex min-h-16 w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-100 hover:bg-bg-3 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-ink"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">注销账号</span>
          <span className="mt-0.5 block text-xs text-gray">
            永久注销，手机号无法再次登录
          </span>
        </span>
        <UserRoundX size={15} className="shrink-0 text-gray" aria-hidden />
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="确认注销账号"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !pending) setConfirming(false);
      }}
      className="p-4"
    >
      <p className="text-sm font-semibold">确认永久注销账号？</p>
      <ul className="mt-2 space-y-1 text-xs text-gray">
        <li>· 名片资料将被清空，昵称显示为「已注销用户」</li>
        <li>· 已发布的需求全部关闭，进行中的举手撤回</li>
        <li>· 退出所有组织，API Key 全部失效</li>
        <li>· 该手机号从此无法再次登录，不可恢复</li>
      </ul>
      {ownedOrgNames.length > 0 && (
        <p className="mt-3 rounded-sm bg-bg-3 px-3 py-2 text-xs text-gray">
          你还是「{ownedOrgNames.join("、")}」的所有者，请先在组织设置里解散组织，才能注销账号。
        </p>
      )}
      {state.error && (
        <p role="alert" className="mt-3 text-xs font-semibold text-ink">
          {state.error}
        </p>
      )}
      <form action={formAction} className="mt-3 grid grid-cols-2 gap-2">
        <button
          ref={cancelRef}
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="h-9 rounded-sm border border-line text-xs font-semibold tracking-[0.08em] text-gray transition-colors duration-100 hover:border-ink hover:text-ink active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={pending || ownedOrgNames.length > 0}
          className="flex h-9 items-center justify-center gap-1.5 rounded-sm bg-ink text-xs font-semibold tracking-[0.08em] text-panel active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
        >
          <UserRoundX size={13} aria-hidden />
          {pending ? "正在注销…" : "确认注销"}
        </button>
      </form>
    </div>
  );
}
