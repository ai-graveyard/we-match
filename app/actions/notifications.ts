"use server";

import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18n/request";
import { localePath } from "@/lib/i18n/routing";

export async function markNotificationReadAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
  // 通知里的 href 不带语言前缀，点开时按当前语言补上
  const href = String(formData.get("href") ?? "");
  if (href.startsWith("/") && !href.startsWith("//")) {
    redirect(localePath(await getRequestLocale(), href));
  }
  refresh();
}

export async function markAllNotificationsReadAction() {
  const user = await getSessionUser();
  if (!user) return;
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  refresh();
}

