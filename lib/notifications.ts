import type { Notification } from "@/lib/db/schema";
import type { ServerDict } from "@/lib/i18n/dict/types";
import { fmt } from "@/lib/i18n/fmt";

// 通知是存库的，写入时还不知道收件人以后用什么语言看。
// 所以只存 type + params，读的时候再按查看者的语言渲染。
// 老数据没有 params，退回入库时写下的 title / body 快照。

export type NotificationPayload =
  | { type: "org_join_requested"; name: string; via: "code" | "plaza"; orgId: number }
  | { type: "org_join_approved"; org: string; orgId: number }
  | { type: "org_join_rejected"; org: string }
  | { type: "connection_requested"; name: string; need: string; needId: number; message?: string | null }
  | { type: "connection_accepted"; name: string; need: string; needId: number }
  | { type: "connection_rejected"; name: string; need: string; needId: number }
  | { type: "connection_cancelled"; name: string; need: string; needId: number }
  | { type: "connection_completed"; need: string; needId: number }
  | { type: "completion_confirmation_requested"; name: string; needId: number }
  | { type: "matches_available"; n: number; need: string };

type Rendered = { title: string; body: string | null };

/** 按给定语言渲染一条通知的标题与正文 */
export function renderNotification(
  t: ServerDict,
  payload: NotificationPayload,
): Rendered {
  const n = t.notification;
  switch (payload.type) {
    case "org_join_requested":
      return {
        title: fmt(n.orgJoinRequestedTitle, { name: payload.name }),
        body:
          payload.via === "code"
            ? n.orgJoinRequestedViaCode
            : n.orgJoinRequestedViaPlaza,
      };
    case "org_join_approved":
      return { title: fmt(n.orgJoinApprovedTitle, { org: payload.org }), body: null };
    case "org_join_rejected":
      return { title: fmt(n.orgJoinRejectedTitle, { org: payload.org }), body: null };
    case "connection_requested":
      return {
        title: fmt(n.connectionRequestedTitle, { name: payload.name }),
        // 举手时写的话是用户自己的原文，不翻译
        body:
          payload.message ||
          fmt(n.connectionAboutNeed, { need: payload.need }),
      };
    case "connection_accepted":
      return {
        title: fmt(n.connectionAcceptedTitle, { name: payload.name }),
        body: fmt(n.connectionAboutNeed, { need: payload.need }),
      };
    case "connection_rejected":
      return {
        title: fmt(n.connectionRejectedTitle, { name: payload.name }),
        body: fmt(n.connectionAboutNeed, { need: payload.need }),
      };
    case "connection_cancelled":
      return {
        title: fmt(n.connectionCancelledTitle, { name: payload.name }),
        body: fmt(n.connectionAboutNeed, { need: payload.need }),
      };
    case "connection_completed":
      return {
        title: n.connectionCompletedTitle,
        body: fmt(n.connectionCompletedBody, { need: payload.need }),
      };
    case "completion_confirmation_requested":
      return {
        title: fmt(n.completionRequestedTitle, { name: payload.name }),
        body: n.completionRequestedBody,
      };
    case "matches_available":
      return {
        title: fmt(n.needMatchesTitle, { n: payload.n }),
        body: fmt(n.needMatchesBody, { need: payload.need }),
      };
  }
}

/** 列表渲染入口：有 params 就按当前语言重排，没有就用入库时的快照 */
export function notificationText(
  t: ServerDict,
  row: Pick<Notification, "type" | "title" | "body" | "params">,
): Rendered {
  if (!row.params) return { title: row.title, body: row.body };
  const payload = { type: row.type, ...row.params } as NotificationPayload;
  try {
    return renderNotification(t, payload);
  } catch {
    // 未知或残缺的 params：宁可显示旧快照，也不要空白
    return { title: row.title, body: row.body };
  }
}
