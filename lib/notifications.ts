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

/**
 * 按给定语言渲染一条通知的标题与正文。
 * payload 来自 DB 里的 type + params（见 notificationText），不受类型系统保护：
 * 未来下线某个通知类型后，旧行还留着对应 params，此时 type 就对不上任何分支。
 * 显式返回 null 而不是让 switch 落空隐式返回 undefined，调用方才能正确回退到快照。
 */
export function renderNotification(
  t: ServerDict,
  payload: NotificationPayload,
): Rendered | null {
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
    default:
      // TS 认为上面已穷举 NotificationPayload，但运行时的 payload.type
      // 来自不受信任的 DB 字符串，可能对不上任何分支
      return null;
  }
}

/** 列表渲染入口：有 params 就按当前语言重排，没有就用入库时的快照 */
export function notificationText(
  t: ServerDict,
  row: Pick<Notification, "type" | "title" | "body" | "params">,
): Rendered {
  const fallback = { title: row.title, body: row.body };
  if (!row.params) return fallback;
  const payload = { type: row.type, ...row.params } as NotificationPayload;
  try {
    // 未知或残缺的 params：宁可显示旧快照，也不要空白或崩溃
    return renderNotification(t, payload) ?? fallback;
  } catch {
    return fallback;
  }
}
