import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  blocks,
  needs,
  reports,
  sessions,
  users,
  type User,
} from "@/lib/db/schema";
import { audit, track } from "@/lib/activity";
import { checkQuota } from "@/lib/quota";
import type { ServerDict } from "@/lib/i18n/dict/types";

// 举报 / 拉黑 / 内容处置的写路径。Action 只做 FormData 解析与鉴权。

export type ReportTargetType = "user" | "need";
export type ReportReason = "spam" | "fraud" | "harassment" | "illegal" | "other";

const REASONS: ReportReason[] = [
  "spam",
  "fraud",
  "harassment",
  "illegal",
  "other",
];

const DETAILS_MAX = 500;

type Actor = Pick<User, "id">;

export async function submitReport(
  user: User,
  input: {
    targetType: string;
    targetId: number;
    reason: string;
    details: string;
  },
  t: ServerDict,
): Promise<{ error: string } | { ok: string }> {
  const { targetId, details } = input;
  if (input.targetType !== "user" && input.targetType !== "need") {
    return { error: t.common.badParams };
  }
  const targetType: ReportTargetType = input.targetType;
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return { error: t.common.badParams };
  }
  if (!REASONS.includes(input.reason as ReportReason)) {
    return { error: t.report.badReason };
  }
  if (details.length > DETAILS_MAX) return { error: t.report.detailsTooLong };
  if (targetType === "user" && targetId === user.id) {
    return { error: t.report.selfReport };
  }

  // 同一目标有 pending 举报时按「已收到」处理，不占额度也不报错——
  // 重复举报多半是着急，不是滥用
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
  if (existing) return { ok: t.report.duplicate };

  const quota = await checkQuota(user, "report.create", t, {
    targetType,
    userId: targetType === "user" ? targetId : undefined,
    needId: targetType === "need" ? targetId : undefined,
  });
  if (!quota.ok) return { error: quota.message };

  await db.insert(reports).values({
    reporterId: user.id,
    targetType,
    targetId,
    reason: input.reason as ReportReason,
    details: details || null,
  });
  await track({
    name: "content_reported",
    userId: user.id,
    entityType: targetType,
    entityId: targetId,
  });
  return { ok: t.report.submitted };
}

export async function blockUser(
  user: User,
  targetId: number,
  t: ServerDict,
): Promise<{ error: string } | { ok: true } | null> {
  if (!Number.isInteger(targetId) || targetId <= 0 || targetId === user.id) {
    return null;
  }
  const quota = await checkQuota(user, "block.create", t, { userId: targetId });
  if (!quota.ok) return { error: quota.message };

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
  return { ok: true };
}

export async function unblockUser(
  user: Actor,
  targetId: number,
): Promise<{ ok: true } | null> {
  if (!Number.isInteger(targetId)) return null;
  await db
    .delete(blocks)
    .where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, targetId)));
  await audit({
    actorId: user.id,
    action: "user_unblocked",
    targetType: "user",
    targetId,
  });
  return { ok: true };
}

export async function moderateContent(
  admin: Actor,
  input: { targetType: string; targetId: number; action: string },
): Promise<{ ok: true } | null> {
  const { targetType, targetId, action } = input;
  if (!Number.isInteger(targetId) || targetId <= 0) return null;

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
      .set({
        status: suspended ? "suspended" : "active",
        suspendedAt: suspended ? new Date() : null,
      })
      .where(and(eq(users.id, targetId), ne(users.status, "deleted")));
    if (suspended) await db.delete(sessions).where(eq(sessions.userId, targetId));
  } else {
    return null;
  }

  await audit({
    actorId: admin.id,
    action: `moderation_${action}`,
    targetType,
    targetId,
  });
  return { ok: true };
}

export async function resolveReport(
  admin: Actor,
  input: { reportId: number; decision: string },
): Promise<{ ok: true } | null> {
  const { reportId, decision } = input;
  if (
    !Number.isInteger(reportId) ||
    (decision !== "resolved" && decision !== "dismissed")
  ) {
    return null;
  }
  await db
    .update(reports)
    .set({ status: decision, handledBy: admin.id, handledAt: new Date() })
    .where(and(eq(reports.id, reportId), eq(reports.status, "pending")));
  await audit({
    actorId: admin.id,
    action: `report_${decision}`,
    targetType: "report",
    targetId: reportId,
  });
  return { ok: true };
}
