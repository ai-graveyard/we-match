"use client";

import { useActionState, useState } from "react";
import {
  cancelConnectionAction,
  confirmConnectionCompletedAction,
  expressInterestAction,
  handleConnectionAction,
  type ConnectionFormState,
} from "@/app/actions/connections";
import type { ContactFieldKey } from "@/lib/card";
import { useDict } from "@/lib/i18n/client";
import { LocaleLink } from "@/lib/i18n/link";
import { fmt } from "@/lib/i18n/fmt";
import { cardFieldLabel, connectionStatusLabel } from "@/lib/i18n/labels";
import {
  badge,
  fieldError,
  panel,
  primaryBtn,
  secondaryBtn,
  sectionLabel,
} from "@/lib/ui";

export type ConnectionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "completed"
  | "cancelled";

type ConnectionRow = {
  id: number;
  initiatorId: number;
  initiatorName: string;
  message: string | null;
  status: ConnectionStatus;
  stale: boolean;
  ownerConfirmed: boolean;
  initiatorConfirmed: boolean;
};

/** 举手表单底部的常驻计数（QUOTA.md 11.2）。剩余额度是用户要主动管理的东西 */
export type RaiseQuota = { pending: number; remaining: number };

// 只在需求详情页的意图面板内使用：外框与面板内的联系方式卡保持一致
export function InterestForm({
  needId,
  label,
  contactOptions,
  quota,
}: {
  needId: number;
  label: string;
  contactOptions: ContactFieldKey[];
  quota?: RaiseQuota;
}) {
  const t = useDict();
  const [state, action, pending] = useActionState<ConnectionFormState, FormData>(
    expressInterestAction,
    {},
  );
  const [contact, setContact] = useState<ContactFieldKey | "">(
    contactOptions[0] ?? "",
  );
  return (
    <form action={action} className={`${panel} p-3`}>
      <input type="hidden" name="needId" value={needId} />
      {contactOptions.length > 0 && (
        <div className="mb-3">
          <label
            htmlFor={`connection-contact-${needId}`}
            className={sectionLabel}
          >
            {t.contact.exchangeLabel}
          </label>
          <select
            id={`connection-contact-${needId}`}
            name="contact"
            value={contact}
            onChange={(event) =>
              setContact(event.target.value as ContactFieldKey)
            }
            className="mt-1 w-full rounded-sm border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
          >
            {contactOptions.map((key) => (
              <option key={key} value={key}>
                {cardFieldLabel(t, key)}
              </option>
            ))}
          </select>
          {contact && (
            <p className="mt-1 text-xs text-gray">
              {fmt(t.contact.exchangePreview, {
                field: cardFieldLabel(t, contact),
              })}
            </p>
          )}
        </div>
      )}
      <label
        htmlFor={`connection-message-${needId}`}
        className={sectionLabel}
      >
        {t.contact.interestMessageLabel}
      </label>
      <textarea
        id={`connection-message-${needId}`}
        name="message"
        maxLength={200}
        rows={3}
        placeholder={t.contact.interestMessagePlaceholder}
        className="mt-1 w-full resize-none rounded-sm border border-line bg-bg px-3 py-2 text-sm outline-none placeholder:text-gray focus:border-ink"
      />
      {state.error && <p className={`mt-2 ${fieldError}`}>{state.error}</p>}
      {state.ok && <p className="mt-2 text-xs text-gray">{state.ok}</p>}
      <button
        type="submit"
        disabled={pending || !!state.ok}
        className={`${primaryBtn} mt-3 w-full`}
      >
        {pending ? t.common.submitting : label}
      </button>
      {quota && (
        <p className="mt-2 text-center font-mono text-3xs text-gray">
          {fmt(t.contact.quotaFooter, {
            pending: quota.pending,
            remaining: quota.remaining,
          })}
        </p>
      )}
    </form>
  );
}

// 单条连接的展示 + 动作区。需求详情面板与「我的连接」中心共用。
// isOwner 决定动作集合：发布者可接受/拒绝，举手方可撤回；双方都能确认完成。
// needHref/needTitle 只在连接中心传入，用来跳回对应需求。
export function ConnectionCard({
  row,
  isOwner,
  otherName,
  needHref,
  needTitle,
  first,
}: {
  row: ConnectionRow;
  isOwner: boolean;
  otherName: string;
  needHref?: string;
  needTitle?: string;
  first: boolean;
}) {
  const t = useDict();
  const myConfirmed = isOwner ? row.ownerConfirmed : row.initiatorConfirmed;
  const otherConfirmed = isOwner ? row.initiatorConfirmed : row.ownerConfirmed;
  return (
    <article className={`p-4 ${first ? "" : "border-t border-line"}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{otherName}</span>
        <span className={`${badge} ml-auto`}>
          {connectionStatusLabel(t, row.status, row.stale)}
        </span>
      </div>
      {needHref && needTitle && (
        <LocaleLink
          href={needHref}
          className="mt-1 block truncate text-2xs text-gray underline-offset-2 hover:text-ink hover:underline"
        >
          {needTitle}
        </LocaleLink>
      )}
      {row.message && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray">{row.message}</p>
      )}

      {/* 同一行、同尺寸、都不做二次确认：拒绝一旦比接受难点，发布者就会
          改为不理会，而不理会是对举手方最差的结果（见 DESIGN.md「举手与连接」） */}
      {isOwner && row.status === "pending" && (
        <OwnerPendingActions connectionId={row.id} />
      )}

      {!isOwner && ["pending", "accepted"].includes(row.status) && (
        <form action={cancelConnectionAction} className="mt-3">
          <input type="hidden" name="connectionId" value={row.id} />
          <button className="text-2xs text-gray underline">
            {t.connection.withdraw}
          </button>
        </form>
      )}

      {row.status === "accepted" && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-2xs text-gray">
            {otherConfirmed
              ? t.connection.otherConfirmed
              : myConfirmed
                ? t.connection.selfConfirmed
                : t.connection.bothPending}
          </p>
          {!myConfirmed && (
            <form action={confirmConnectionCompletedAction} className="mt-2">
              <input type="hidden" name="connectionId" value={row.id} />
              <button className={secondaryBtn}>
                {t.connection.confirmDone}
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

export function ConnectionPanel({
  rows,
  viewerId,
  ownerId,
}: {
  rows: ConnectionRow[];
  viewerId: number;
  ownerId: number;
}) {
  const t = useDict();
  if (rows.length === 0) return null;
  const isOwner = viewerId === ownerId;

  return (
    <section className="mt-4">
      <h2 className={sectionLabel}>
        {isOwner
          ? fmt(t.connection.ownerHeading, { n: rows.length })
          : t.connection.viewerHeading}
      </h2>
      <div className={`mt-2 ${panel}`}>
        {rows.map((row, index) => (
          <ConnectionCard
            key={row.id}
            row={row}
            isOwner={isOwner}
            otherName={row.initiatorName}
            first={index === 0}
          />
        ))}
      </div>
    </section>
  );
}

function OwnerPendingActions({ connectionId }: { connectionId: number }) {
  const t = useDict();
  const [state, action] = useActionState<ConnectionFormState, FormData>(
    handleConnectionAction,
    {},
  );
  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-2">
        <form action={action}>
          <input type="hidden" name="connectionId" value={connectionId} />
          <input type="hidden" name="decision" value="reject" />
          <button className={`${secondaryBtn} w-full`}>
            {t.connection.reject}
          </button>
        </form>
        <form action={action}>
          <input type="hidden" name="connectionId" value={connectionId} />
          <input type="hidden" name="decision" value="accept" />
          <button className={`${primaryBtn} w-full`}>
            {t.connection.accept}
          </button>
        </form>
      </div>
      {state.error && <p className={`mt-2 ${fieldError}`}>{state.error}</p>}
    </div>
  );
}
