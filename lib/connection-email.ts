import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { needs, notifications, orgMembers, users } from "@/lib/db/schema";
import { getMailProvider, isMailDeliveryEnabled, type MailProvider } from "@/lib/mail";
import { SERVER_DICTS } from "@/lib/i18n/dict";
import { renderNotification, type NotificationPayload } from "@/lib/notifications";

export const CONNECTION_EMAIL_TYPES = new Set(["connection_requested", "connection_accepted", "connection_rejected"]);

// 只从固定站点配置构造邮件链接，绝不使用请求 Host。邮件不携带联系方式或举手留言。
export async function sendConnectionEmail(notificationId: number, provider?: MailProvider) {
  if (!provider && !isMailDeliveryEnabled()) return;
  const origin = process.env.SITE_ORIGIN;
  if (!origin) return;
  let url: URL;
  try {
    url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
  } catch { return; }
  const row = db.select({ notification: notifications, user: users }).from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId)).where(eq(notifications.id, notificationId)).get();
  if (!row || row.user.status !== "active" || !row.user.connectionEmailEnabled || !CONNECTION_EMAIL_TYPES.has(row.notification.type)) return;
  const needId = Number(row.notification.params?.needId);
  if (!Number.isSafeInteger(needId) || needId <= 0) return;
  const need = db.select().from(needs).where(eq(needs.id, needId)).get();
  if (!need || need.deletedAt || need.moderationStatus !== "visible") return;
  if (need.orgId != null && !db.select({ id: orgMembers.userId }).from(orgMembers).where(and(eq(orgMembers.orgId, need.orgId), eq(orgMembers.userId, row.user.id))).get()) return;
  const payload = { ...row.notification.params, type: row.notification.type, need: need.title, message: null } as NotificationPayload;
  const zh = renderNotification(SERVER_DICTS.zh, payload);
  const en = renderNotification(SERVER_DICTS.en, payload);
  if (!zh || !en) return;
  const link = `${url.origin}/zh/needs/${needId}`;
  await (provider ?? getMailProvider()).send({
    to: row.user.loginEmail,
    subject: `We Match · ${zh.title.replace(/[\r\n]/g, " ")}`,
    text: `${zh.title}\n${zh.body ?? ""}\n\n查看并处理：${link}\n联系方式仅在登录后按连接权限显示。\n关闭邮件提醒：${url.origin}/zh/me?section=settings\n\n${en.title}\n${en.body ?? ""}\n\nView and respond: ${url.origin}/en/needs/${needId}\nContact details stay on the site.\nEmail preferences: ${url.origin}/en/me?section=settings`,
  });
}

export async function deliverConnectionEmail(notificationId: number) {
  try { await sendConnectionEmail(notificationId); }
  catch { console.error("[MAIL] connection notification delivery failed", { notificationId }); }
}
