"use server";

import { redirect } from "next/navigation";
import { and, eq, inArray, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  apiKeys,
  blocks,
  connections,
  joinRequests,
  needs,
  notifications,
  orgMembers,
  orgs,
  sessions,
  users,
  verificationCodes,
} from "@/lib/db/schema";
import {
  destroySession,
  getSessionUser,
  requestVerificationCode,
  verifyCodeAndLogin,
} from "@/lib/auth";
import { audit } from "@/lib/activity";

export type AuthFormState = { error?: string; sentAt?: number };

// 登录后回跳只允许站内路径，防开放重定向
function safeNext(next: unknown): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/";
}

export async function requestCodeAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const { error } = await requestVerificationCode(phone);
  if (error) return { error };
  return { sentAt: Date.now() };
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const { error, isNew } = await verifyCodeAndLogin(phone, code);
  if (error) return { error };
  const next = safeNext(formData.get("next"));
  // 从具体任务触发的首次登录优先回到原页面；首页登录才进入可跳过的新用户引导。
  redirect(isNew && next === "/" ? "/me/card?welcome=1" : next);
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export type DeleteAccountState = { error?: string };

// 永久注销：清空个人资料并使会话、API Key 全部失效。
// 手机号保留在 users 表（status = deleted），从此无法再次登录。
export async function deleteAccountAction(): Promise<DeleteAccountState> {
  const user = await getSessionUser();
  if (!user) return { error: "请先登录" };

  // owner 不能退出组织，同理不能带着组织注销——先解散
  const owned = await db
    .select({ name: orgs.name })
    .from(orgs)
    .where(eq(orgs.ownerId, user.id));
  if (owned.length > 0) {
    return {
      error: `你还是「${owned.map((o) => o.name).join("、")}」的所有者，请先解散组织再注销`,
    };
  }

  const now = new Date();
  // 关闭全部需求（发布者已联系不上，不再对外展示）
  await db
    .update(needs)
    .set({ status: "closed", updatedAt: now })
    .where(and(eq(needs.userId, user.id), ne(needs.status, "closed")));
  // 撤回进行中的举手
  await db
    .update(connections)
    .set({ status: "cancelled", updatedAt: now })
    .where(
      and(
        eq(connections.initiatorId, user.id),
        inArray(connections.status, ["pending", "accepted"]),
      ),
    );
  // 退出所有组织（上面已确保不是任何组织的 owner）
  await db.delete(orgMembers).where(eq(orgMembers.userId, user.id));
  await db
    .delete(joinRequests)
    .where(
      and(eq(joinRequests.userId, user.id), eq(joinRequests.status, "pending")),
    );
  await db.delete(apiKeys).where(eq(apiKeys.userId, user.id));
  await db.delete(notifications).where(eq(notifications.userId, user.id));
  await db
    .delete(blocks)
    .where(or(eq(blocks.blockerId, user.id), eq(blocks.blockedId, user.id)));
  await db
    .delete(verificationCodes)
    .where(eq(verificationCodes.phone, user.phone));
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  // 清空个人资料；手机号保留用于永久禁止再次登录
  await db
    .update(users)
    .set({
      nickname: "已注销用户",
      bio: null,
      tags: [],
      city: null,
      wechat: null,
      email: null,
      contactPhone: null,
      weixinMp: null,
      weixinChannels: null,
      xiaohongshu: null,
      weibo: null,
      fieldVisibility: {},
      status: "deleted",
      deletedAt: now,
    })
    .where(eq(users.id, user.id));
  await audit({
    actorId: user.id,
    action: "account_deleted",
    targetType: "user",
    targetId: user.id,
  });
  await destroySession();
  redirect("/");
}
