"use client";

import { useActionState } from "react";
import {
  cancelConnectionAction,
  confirmConnectionCompletedAction,
  expressInterestAction,
  handleConnectionAction,
  type ConnectionFormState,
} from "@/app/actions/connections";

type ConnectionRow = {
  id: number;
  initiatorId: number;
  initiatorName: string;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
  ownerConfirmed: boolean;
  initiatorConfirmed: boolean;
};

const statusLabel: Record<ConnectionRow["status"], string> = {
  pending: "等待回应",
  accepted: "已连接",
  rejected: "未接受",
  completed: "已完成",
  cancelled: "已撤回",
};

export function InterestForm({ needId, label }: { needId: number; label: string }) {
  const [state, action, pending] = useActionState<ConnectionFormState, FormData>(
    expressInterestAction,
    {},
  );
  return (
    <form action={action} className="rounded-md border border-line bg-panel p-4">
      <input type="hidden" name="needId" value={needId} />
      <label
        htmlFor={`connection-message-${needId}`}
        className="text-[11px] font-semibold tracking-[0.08em] text-gray"
      >
        给发布者的话（可选）
      </label>
      <textarea
        id={`connection-message-${needId}`}
        name="message"
        maxLength={200}
        rows={3}
        placeholder="简单说说你能提供什么，或想进一步了解什么"
        className="mt-1 w-full resize-none rounded-sm border border-line bg-bg px-3 py-2 text-sm outline-none placeholder:text-gray focus:border-ink"
      />
      {state.error && <p className="mt-2 text-xs text-accent">{state.error}</p>}
      {state.ok && <p className="mt-2 text-xs text-gray">{state.ok}</p>}
      <button
        type="submit"
        disabled={pending || !!state.ok}
        className="mt-3 flex h-11 w-full items-center justify-center rounded-sm bg-accent text-xs font-semibold tracking-[0.08em] text-panel active:translate-y-px disabled:opacity-60"
      >
        {pending ? "提交中" : label}
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
  if (rows.length === 0) return null;
  const isOwner = viewerId === ownerId;

  return (
    <section className="mt-4">
      <h2 className="text-[11px] font-semibold tracking-[0.08em] text-gray">
        {isOwner ? `举手记录（${rows.length}）` : "我的举手"}
      </h2>
      <div className="mt-2 rounded-md border border-line bg-panel">
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
                <span className="ml-auto rounded-sm bg-bg-3 px-1.5 py-0.5 font-mono text-[10px] text-gray">
                  {statusLabel[row.status]}
                </span>
              </div>
              {row.message && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray">{row.message}</p>
              )}

              {isOwner && row.status === "pending" && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <form action={handleConnectionAction}>
                    <input type="hidden" name="connectionId" value={row.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <button className="h-10 w-full rounded-sm border border-line text-xs font-semibold">
                      暂不接受
                    </button>
                  </form>
                  <form action={handleConnectionAction}>
                    <input type="hidden" name="connectionId" value={row.id} />
                    <input type="hidden" name="decision" value="accept" />
                    <button className="h-10 w-full rounded-sm bg-accent text-xs font-semibold text-panel">
                      接受并连接
                    </button>
                  </form>
                </div>
              )}

              {!isOwner && ["pending", "accepted"].includes(row.status) && (
                <form action={cancelConnectionAction} className="mt-3">
                  <input type="hidden" name="connectionId" value={row.id} />
                  <button className="text-[11px] text-gray underline">撤回举手</button>
                </form>
              )}

              {row.status === "accepted" && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-[11px] text-gray">
                    {otherConfirmed
                      ? "对方已确认完成，请确认结果"
                      : myConfirmed
                        ? "已确认，等待对方确认"
                        : "线下对接完成后，由双方分别确认"}
                  </p>
                  {!myConfirmed && (
                    <form action={confirmConnectionCompletedAction} className="mt-2">
                      <input type="hidden" name="connectionId" value={row.id} />
                      <button className="h-9 rounded-sm border border-ink px-3 text-[11px] font-semibold">
                        确认这次匹配已完成
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
