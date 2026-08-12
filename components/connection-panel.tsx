"use client";

import { useActionState } from "react";
import {
  cancelConnectionAction,
  confirmConnectionCompletedAction,
  expressInterestAction,
  handleConnectionAction,
  type ConnectionFormState,
} from "@/app/actions/connections";
import { useDict } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/fmt";
import { connectionStatusLabel } from "@/lib/i18n/labels";
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
  ownerConfirmed: boolean;
  initiatorConfirmed: boolean;
};

// 只在需求详情页的意图面板内使用：外框与面板内的联系方式卡保持一致
export function InterestForm({ needId, label }: { needId: number; label: string }) {
  const t = useDict();
  const [state, action, pending] = useActionState<ConnectionFormState, FormData>(
    expressInterestAction,
    {},
  );
  return (
    <form action={action} className={`${panel} p-3`}>
      <input type="hidden" name="needId" value={needId} />
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
    </form>
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
        {rows.map((row, index) => {
          const myConfirmed = isOwner ? row.ownerConfirmed : row.initiatorConfirmed;
          const otherConfirmed = isOwner
            ? row.initiatorConfirmed
            : row.ownerConfirmed;
          return (
            <article
              key={row.id}
              className={`p-4 ${index > 0 ? "border-t border-line" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{row.initiatorName}</span>
                <span className={`${badge} ml-auto`}>
                  {connectionStatusLabel(t, row.status)}
                </span>
              </div>
              {row.message && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray">{row.message}</p>
              )}

              {/* 同一行、同尺寸、都不做二次确认：拒绝一旦比接受难点，发布者就会
                  改为不理会，而不理会是对举手方最差的结果（见 DESIGN.md「举手与连接」） */}
              {isOwner && row.status === "pending" && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <form action={handleConnectionAction}>
                    <input type="hidden" name="connectionId" value={row.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <button className={`${secondaryBtn} w-full`}>
                      {t.connection.reject}
                    </button>
                  </form>
                  <form action={handleConnectionAction}>
                    <input type="hidden" name="connectionId" value={row.id} />
                    <input type="hidden" name="decision" value="accept" />
                    <button className={`${primaryBtn} w-full`}>
                      {t.connection.accept}
                    </button>
                  </form>
                </div>
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
        })}
      </div>
    </section>
  );
}
