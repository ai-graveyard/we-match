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
import { ORG_LIMITS } from "@/lib/orgs";
import { CopyButton } from "@/components/copy-button";
import { useDict, useLocale } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/fmt";
import { relativeTime, requestViaLabel } from "@/lib/i18n/labels";
import { localePath } from "@/lib/i18n/routing";

const smallBtnCls =
  "inline-flex h-11 items-center justify-center gap-1 rounded-sm border border-ink bg-panel px-3 text-sm font-semibold tracking-[0.06em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px";

// 邀请码面板：查看、复制码/链接、两步确认重置
export function InviteCodePanel({
  orgId,
  code,
}: {
  orgId: number;
  code: string;
}) {
  const t = useDict();
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
          label={t.org.inviteCopyLink}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        {confirming ? (
          <>
            <form action={resetInviteCodeAction}>
              <input type="hidden" name="orgId" value={orgId} />
              <button type="submit" className={smallBtnCls}>
                {t.org.inviteResetConfirm}
              </button>
            </form>
            <button
              type="button"
              className="text-2xs text-gray hover:text-ink"
              onClick={() => setConfirming(false)}
            >
              {t.common.cancel}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="flex items-center gap-1 text-2xs text-gray hover:text-ink"
            onClick={() => setConfirming(true)}
          >
            <RotateCw size={11} aria-hidden />
            {t.org.inviteReset}
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
  const t = useDict();
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    handleRequestAction,
    {},
  );

  if (requests.length === 0)
    return <p className="text-xs text-gray">{t.org.requestsEmpty}</p>;

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
              href={localePath(locale, `/u/${req.applicant.id}`)}
              className="min-w-0 truncate text-sm font-semibold hover:underline"
            >
              {req.applicant.nickname}
            </a>
            <span className="shrink-0 rounded-sm bg-bg-3 px-1.5 py-px font-mono text-3xs text-gray">
              {requestViaLabel(t, req.via)}
            </span>
            <span className="shrink-0 font-mono text-3xs text-gray">
              {relativeTime(t, new Date(req.createdAt))}
            </span>
            <div className="ml-auto flex shrink-0 gap-1.5">
              <form action={formAction}>
                <input type="hidden" name="requestId" value={req.id} />
                <input type="hidden" name="decision" value="approve" />
                <button type="submit" disabled={pending} className={smallBtnCls}>
                  <Check size={12} aria-hidden />
                  {t.org.requestApprove}
                </button>
              </form>
              <form action={formAction}>
                <input type="hidden" name="requestId" value={req.id} />
                <input type="hidden" name="decision" value="reject" />
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex h-11 items-center gap-1 rounded-sm px-2 text-sm text-gray transition-colors duration-100 hover:text-ink"
                >
                  <X size={14} aria-hidden />
                  {t.org.requestReject}
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
  const t = useDict();
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex items-center gap-1.5">
        <form action={removeMemberAction}>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="userId" value={userId} />
          <button
            type="submit"
            className="text-2xs font-semibold text-ink"
          >
            {t.org.memberRemoveConfirm}
          </button>
        </form>
        <button
          type="button"
          className="text-2xs text-gray"
          onClick={() => setConfirming(false)}
        >
          {t.common.cancel}
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={fmt(t.org.memberRemoveLabel, { name: nickname })}
      className="flex items-center gap-1 text-2xs text-gray transition-colors duration-100 hover:text-ink"
      onClick={() => setConfirming(true)}
    >
      <UserMinus size={12} aria-hidden />
      {t.org.memberRemove}
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
  const t = useDict();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<OrgFormState, FormData>(
    promoteOrgAdminAction,
    {},
  );

  if (limitReached) {
    return (
      <span
        className="text-2xs text-gray"
        title={fmt(t.org.adminFullHint, { max: ORG_LIMITS.maxAdmins })}
      >
        {t.org.adminFull}
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
              className="text-2xs font-semibold text-ink disabled:text-gray"
            >
              {pending ? t.org.memberPromoting : t.org.memberPromoteConfirm}
            </button>
          </form>
          <button
            type="button"
            className="text-2xs text-gray"
            onClick={() => setConfirming(false)}
          >
            {t.common.cancel}
          </button>
        </span>
        {state.error && (
          <span className="max-w-48 text-right text-3xs text-ink">
            {state.error}
          </span>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={fmt(t.org.memberPromoteLabel, { name: nickname })}
      className="flex items-center gap-1 text-2xs text-gray transition-colors duration-100 hover:text-ink"
      onClick={() => setConfirming(true)}
    >
      <ShieldCheck size={12} aria-hidden />
      {t.org.memberPromote}
    </button>
  );
}

export function LeaveOrgButton({ orgId }: { orgId: number }) {
  const t = useDict();
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <form action={leaveOrgAction}>
          <input type="hidden" name="orgId" value={orgId} />
          <button type="submit" className={smallBtnCls}>
            {t.org.leaveConfirm}
          </button>
        </form>
        <button
          type="button"
          className="text-2xs text-gray"
          onClick={() => setConfirming(false)}
        >
          {t.common.cancel}
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      className="text-2xs text-gray transition-colors duration-100 hover:text-ink"
      onClick={() => setConfirming(true)}
    >
      {t.org.leave}
    </button>
  );
}

export function DissolveOrgButton({ orgId }: { orgId: number }) {
  const t = useDict();
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <form action={dissolveOrgAction}>
          <input type="hidden" name="orgId" value={orgId} />
          <button
            type="submit"
            className="h-11 rounded-sm border border-ink bg-panel px-3 text-sm font-semibold tracking-[0.06em] text-ink transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px"
          >
            {t.org.dissolveConfirm}
          </button>
        </form>
        <button
          type="button"
          className="text-2xs text-gray"
          onClick={() => setConfirming(false)}
        >
          {t.common.cancel}
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      className="text-2xs text-gray transition-colors duration-100 hover:text-ink"
      onClick={() => setConfirming(true)}
    >
      {t.org.dissolve}
    </button>
  );
}
