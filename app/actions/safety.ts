"use server";

import { and, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import {
  blocks,
  needs,
  reports,
  sessions,
  users,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { audit, track } from "@/lib/activity";

export type ReportFormState = { error?: string; ok?: string };

export async function reportContentAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const user = await getSessionUser();
  if (!user) return { error: "请先登录" };
  const targetType = String(formData.get("targetType"));
  const targetId = Number(formData.get("targetId"));
  const reason = String(formData.get("reason"));
  const details = String(formData.get("details") ?? "").trim();
  if (targetType !== "user" && targetType !== "need") return { error: "参数不正确" };
  if (!Number.isInteger(targetId) || targetId <= 0) return { error: "参数不正确" };
  if (!["spam", "fraud", "harassment", "illegal", "other"].includes(reason)) {
    return { error: "请选择举报原因" };
  }
  if (details.length > 500) return { error: "补充说明最多 500 字" };
  if (targetType === "user" && targetId === user.id) return { error: "不能举报自己" };

  const [existing] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, user.id),
        eq(reports.targetType, targetType),
        eq(reports.targetId, targetId),
        eq(reports.status, "pending"),
      ),
    )
    .limit(1);
  if (existing) return { ok: "这条内容已经提交过举报，正在处理中" };

  await db.insert(reports).values({
    reporterId: user.id,
    targetType,
    targetId,
    reason: reason as "spam" | "fraud" | "harassment" | "illegal" | "other",
    details: details || null,
  });
  await track({
    name: "content_reported",
    userId: user.id,
    entityType: targetType,
    entityId: targetId,
  });
  return { ok: "举报已提交，我们会尽快处理" };
}

export async function blockUserAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const targetId = Number(formData.get("targetId"));
  if (!Number.isInteger(targetId) || targetId <= 0 || targetId === user.id) return;
  await db
    .insert(blocks)
    .values({ blockerId: user.id, blockedId: targetId })
    .onConflictDoNothing();
  await audit({
    actorId: user.id,
    action: "user_blocked",
    targetType: "user",
    targetId,
  });
  refresh();
}

export async function unblockUserAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const targetId = Number(formData.get("targetId"));
  if (!Number.isInteger(targetId)) return;
  await db
    .delete(blocks)
    .where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, targetId)));
  await audit({
    actorId: user.id,
    action: "user_unblocked",
    targetType: "user",
    targetId,
  });
  refresh();
}

export async function moderateContentAction(formData: FormData) {
  const admin = await getSessionUser();
  if (!admin || !isAdmin(admin)) return;
  const targetType = String(formData.get("targetType"));
  const targetId = Number(formData.get("targetId"));
  const action = String(formData.get("moderationAction"));
  if (!Number.isInteger(targetId) || targetId <= 0) return;

  if (targetType === "need" && ["hide", "restore"].includes(action)) {
    await db
      .update(needs)
      .set({ moderationStatus: action === "hide" ? "hidden" : "visible" })
      .where(eq(needs.id, targetId));
  } else if (targetType === "user" && ["suspend", "restore"].includes(action)) {
    const suspended = action === "suspend";
    // 已注销账号永久失效，管理员也不能暂停/恢复
    await db
      .update(users)
      .set({ status: suspended ? "suspended" : "active", suspendedAt: suspended ? new Date() : null })
      .where(and(eq(users.id, targetId), ne(users.status, "deleted")));
    if (suspended) await db.delete(sessions).where(eq(sessions.userId, targetId));
  } else {
    return;
  }
  await audit({
    actorId: admin.id,
    action: `moderation_${action}`,
    targetType,
    targetId,
  });
  refresh();
}

export async function handleReportAction(formData: FormData) {
  const admin = await getSessionUser();
  if (!admin || !isAdmin(admin)) return;
  const reportId = Number(formData.get("reportId"));
  const decision = String(formData.get("decision"));
  if (!Number.isInteger(reportId) || !["resolved", "dismissed"].includes(decision)) return;
  await db
    .update(reports)
    .set({
      status: decision as "resolved" | "dismissed",
      handledBy: admin.id,
      handledAt: new Date(),
    })
    .where(and(eq(reports.id, reportId), eq(reports.status, "pending")));
  await audit({
    actorId: admin.id,
    action: `report_${decision}`,
    targetType: "report",
    targetId: reportId,
  });
  refresh();
}
