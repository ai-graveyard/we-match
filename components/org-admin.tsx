"use client";

import { useActionState, useState } from "react";
import { Check, RotateCw, ShieldCheck, UserMinus, X } from "lucide-react";
import {
  dissolveOrgAction,
  handleRequestAction,
  leaveOrgAction,
  promoteOrgAdminAction,
  removeMemberAction,
  resetInviteCodeAction,
  type OrgFormState,
} from "@/app/actions/orgs";
import { REQUEST_VIA_LABELS } from "@/lib/orgs";
import { CopyButton } from "@/components/copy-button";
import { relativeTime } from "@/lib/format";

const smallBtnCls =
  "inline-flex h-8 items-center justify-center gap-1 rounded-sm border border-ink bg-panel px-3 text-[11px] font-semibold tracking-[0.08em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px";

// 邀请码面板：查看、复制码/链接、两步确认重置
export function InviteCodePanel({
  orgId,
  code,
}: {
  orgId: number;
  code: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="rounded-sm border border-line bg-bg px-3 py-1.5 font-mono text-base tracking-[0.2em]">
          {code}
        </span>
        <CopyButton text={code} accent />
        <CopyButton
          text={() =>
            `${location.origin}/orgs?code=${encodeURIComponent(code)}`
          }
          label="复制邀请链接"
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        {confirming ? (
          <>
            <form action={resetInviteCodeAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <button type="submit" className={smallBtnCls}>
                确认重置（旧码立即失效）
              </button>
            </form>
            <button
              type="button"
              className="text-[11px] text-gray hover:text-ink"
              onClick={() => setConfirming(false)}
            >
              取消
            </button>
          </>
        ) : (
          <button
            type="button"
            className="flex items-center gap-1 text-[11px] text-gray hover:text-ink"
            onClick={() => setConfirming(true)}
          >
            <RotateCw size={11} aria-hidden />
            重置邀请码
          </button>
        )}
      </div>
    </div>
  );
}

export type PendingRequest = {
  id: number;
  via: "code" | "plaza";
  createdAt: number;
  applicant: { id: number; nickname: string };
};

// 待审批申请列表（两条路径汇入，标注来源）
export function RequestList({ requests }: { requests: PendingRequest[] }) {
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    handleRequestAction,
    {},
  );

  if (requests.length === 0)
    return <p className="text-xs text-gray">暂无待审批申请</p>;

  return (
    <div>
      {state.error && <p className="mb-2 text-xs text-ink">{state.error}</p>}
      <div className="rounded-sm border border-line">
        {requests.map((req, i) => (
          <div
            key={req.id}
            className={`flex items-center gap-2 px-3 py-2.5 ${
              i > 0 ? "border-t border-line" : ""
            }`}
          >
            <a
              href={`/u/${req.applicant.id}`}
              className="min-w-0 truncate text-sm font-semibold hover:underline"
            >
              {req.applicant.nickname}
            </a>
            <span className="shrink-0 rounded-sm bg-bg-3 px-1.5 py-px font-mono text-[10px] text-gray">
              {REQUEST_VIA_LABELS[req.via]}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-gray">
              {relativeTime(new Date(req.createdAt))}
            </span>
            <div className="ml-auto flex shrink-0 gap-1.5">
              <form action={formAction}>
                <input type="hidden" name="requestId" value={req.id} />
                <input type="hidden" name="decision" value="approve" />
                <button type="submit" disabled={pending} className={smallBtnCls}>
                  <Check size={12} aria-hidden />
                  通过
                </button>
              </form>
              <form action={formAction}>
                <input type="hidden" name="requestId" value={req.id} />
                <input type="hidden" name="decision" value="reject" />
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-8 items-center gap-1 rounded-sm px-2 text-[11px] text-gray transition-colors duration-100 hover:text-ink"
                >
                  <X size={12} aria-hidden />
                  拒绝
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RemoveMemberButton({
  orgId,
  userId,
  nickname,
}: {
  orgId: number;
  userId: number;
  nickname: string;
}) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex items-center gap-1.5">
        <form action={removeMemberAction}>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            className="text-[11px] font-semibold text-ink"
          >
            确认移除
          </button>
        </form>
        <button
          type="button"
          className="text-[11px] text-gray"
          onClick={() => setConfirming(false)}
        >
          取消
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={`移除成员 ${nickname}`}
      className="flex items-center gap-1 text-[11px] text-gray transition-colors duration-100 hover:text-ink"
      onClick={() => setConfirming(true)}
    >
      <UserMinus size={12} aria-hidden />
      移除
    </button>
  );
}

export function PromoteAdminButton({
  orgId,
  userId,
  nickname,
  limitReached,
}: {
  orgId: number;
  userId: number;
  nickname: string;
  limitReached: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    promoteOrgAdminAction,
    {},
  );

  if (limitReached) {
    return (
      <span className="text-[11px] text-gray" title="已任命 3 名管理员，拥有者另计">
        管理员已满
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="flex flex-col items-end gap-1">
        <span className="flex items-center gap-1.5">
          <form action={formAction}>
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="userId" value={userId} />
            <button
              type="submit"
              disabled={pending}
              className="text-[11px] font-semibold text-ink disabled:text-gray"
            >
              {pending ? "任命中…" : "确认任命"}
            </button>
          </form>
          <button
            type="button"
            className="text-[11px] text-gray"
            onClick={() => setConfirming(false)}
          >
            取消
          </button>
        </span>
        {state.error && (
          <span className="max-w-48 text-right text-[10px] text-ink">
            {state.error}
          </span>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={`将 ${nickname} 设为管理员`}
      className="flex items-center gap-1 text-[11px] text-gray transition-colors duration-100 hover:text-ink"
      onClick={() => setConfirming(true)}
    >
      <ShieldCheck size={12} aria-hidden />
      设为管理员
    </button>
  );
}

export function LeaveOrgButton({ orgId }: { orgId: number }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <form action={leaveOrgAction}>
          <input type="hidden" name="orgId" value={orgId} />
          <button type="submit" className={smallBtnCls}>
            确认退出（组织内需求将关闭）
          </button>
        </form>
        <button
          type="button"
          className="text-[11px] text-gray"
          onClick={() => setConfirming(false)}
        >
          取消
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      className="text-[11px] text-gray transition-colors duration-100 hover:text-ink"
      onClick={() => setConfirming(true)}
    >
      退出组织
    </button>
  );
}

export function DissolveOrgButton({ orgId }: { orgId: number }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <form action={dissolveOrgAction}>
          <input type="hidden" name="orgId" value={orgId} />
          <button
            type="submit"
            className="h-8 rounded-sm border border-ink bg-panel px-3 text-[11px] font-semibold tracking-[0.08em] text-ink transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px"
          >
            确认解散（需求和成员一并删除，不可恢复）
          </button>
        </form>
        <button
          type="button"
          className="text-[11px] text-gray"
          onClick={() => setConfirming(false)}
        >
          取消
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      className="text-[11px] text-gray transition-colors duration-100 hover:text-ink"
      onClick={() => setConfirming(true)}
    >
      解散组织
    </button>
  );
}
