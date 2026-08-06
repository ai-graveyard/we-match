"use server";

import { and, eq, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { joinRequests, needs, orgMembers, orgs } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import {
  ORG_LIMITS,
  isOrgAdminRole,
  normalizeInviteCode,
} from "@/lib/orgs";
import {
  closeUserOrgNeeds,
  countOrgAdmins,
  countUserOrgs,
  generateUniqueInviteCode,
  getMembership,
} from "@/lib/queries";
import { notify, track } from "@/lib/activity";
import { consumeRateLimit } from "@/lib/rate-limit";

export type OrgFormState = { error?: string; ok?: string };

async function notifyOrgAdmins(orgId: number, input: { title: string; body: string }) {
  const admins = await db
    .select({ userId: orgMembers.userId })
    .from(orgMembers)
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        or(eq(orgMembers.role, "owner"), eq(orgMembers.role, "admin")),
      ),
    );
  await Promise.all(
    admins.map(({ userId }) =>
      notify({
        userId,
        type: "org_join_requested",
        title: input.title,
        body: input.body,
        href: `/orgs/${orgId}`,
      }),
    ),
  );
}

export async function createOrgAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const user = await getSessionUser();
  if (!user) return { error: "登录已失效，请重新登录" };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "组织名称不能为空" };
  if (name.length > ORG_LIMITS.name)
    return { error: `组织名称最多 ${ORG_LIMITS.name} 字` };
  const description =
    String(formData.get("description") ?? "")
      .trim()
      .slice(0, ORG_LIMITS.description) || null;
  const visRaw = String(formData.get("visibility") ?? "private");
  const visibility = visRaw === "public" ? "public" : "private";

  if ((await countUserOrgs(user.id)) >= ORG_LIMITS.maxJoined) {
    return { error: `最多同时加入 ${ORG_LIMITS.maxJoined} 个组织（创建也计入）` };
  }

  const inviteCode = await generateUniqueInviteCode();
  const [org] = await db
    .insert(orgs)
    .values({ name, description, visibility, ownerId: user.id, inviteCode })
    .returning({ id: orgs.id });
  await db
    .insert(orgMembers)
    .values({ orgId: org.id, userId: user.id, role: "owner" });
  redirect(`/orgs/${org.id}`);
}

// 两条申请路径共用的检查，返回 error 或 null
async function checkCanApply(
  userId: number,
  orgId: number,
): Promise<string | null> {
  if (await getMembership(orgId, userId)) return "你已经是该组织成员";
  if ((await countUserOrgs(userId)) >= ORG_LIMITS.maxJoined)
    return `最多同时加入 ${ORG_LIMITS.maxJoined} 个组织`;
  const [pending] = await db
    .select({ id: joinRequests.id })
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.orgId, orgId),
        eq(joinRequests.userId, userId),
        eq(joinRequests.status, "pending"),
      ),
    )
    .limit(1);
  if (pending) return "已提交过申请，等待管理员审批";
  return null;
}

export async function applyByCodeAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const user = await getSessionUser();
  if (!user) return { error: "请先登录" };
  const code = normalizeInviteCode(String(formData.get("code") ?? ""));
  if (!code) return { error: "请输入邀请码" };
  if (
    !(await consumeRateLimit(
      `org-code:${user.id}`,
      ORG_LIMITS.codeAttemptsPerHour,
      60 * 60 * 1000,
    ))
  )
    return { error: "尝试次数过多，请一小时后再试" };
  const [org] = await db
    .select({ id: orgs.id, name: orgs.name })
    .from(orgs)
    .where(eq(orgs.inviteCode, code))
    .limit(1);
  if (!org) {
    return { error: "邀请码无效" };
  }
  const err = await checkCanApply(user.id, org.id);
  if (err) return { error: err };
  await db
    .insert(joinRequests)
    .values({ orgId: org.id, userId: user.id, via: "code" });
  await notifyOrgAdmins(org.id, {
    title: `${user.nickname} 申请加入组织`,
    body: "通过邀请码提交，等待审批",
  });
  await track({ name: "org_join_requested", userId: user.id, entityType: "org", entityId: org.id });
  return { ok: `已向「${org.name}」提交申请，等待管理员审批` };
}

export async function applyPlazaAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const user = await getSessionUser();
  if (!user) return { error: "请先登录" };
  const orgId = Number(formData.get("orgId"));
  if (!Number.isInteger(orgId) || orgId <= 0) return { error: "参数不正确" };
  const [org] = await db
    .select({ id: orgs.id, visibility: orgs.visibility })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);
  // 私有组织不接受广场申请（也不暴露存在性）
  if (!org || org.visibility !== "public") return { error: "组织不存在" };
  const err = await checkCanApply(user.id, orgId);
  if (err) return { error: err };
  await db
    .insert(joinRequests)
    .values({ orgId, userId: user.id, via: "plaza" });
  await notifyOrgAdmins(orgId, {
    title: `${user.nickname} 申请加入组织`,
    body: "通过组织广场提交，等待审批",
  });
  await track({ name: "org_join_requested", userId: user.id, entityType: "org", entityId: orgId });
  refresh();
  return { ok: "已提交申请，等待管理员审批" };
}

async function requireOwner(orgId: number) {
  const user = await getSessionUser();
  if (!user) return null;
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
  if (!org || org.ownerId !== user.id) return null;
  return { user, org };
}

async function requireOrgAdmin(orgId: number) {
  const user = await getSessionUser();
  if (!user) return null;
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
  if (!org) return null;
  const membership = await getMembership(orgId, user.id);
  if (!membership || !isOrgAdminRole(membership.role)) return null;
  return { user, org, membership };
}

export async function handleRequestAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const requestId = Number(formData.get("requestId"));
  const decision = String(formData.get("decision"));
  if (!Number.isInteger(requestId) || !["approve", "reject"].includes(decision))
    return { error: "参数不正确" };
  const [request] = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.id, requestId))
    .limit(1);
  if (!request || request.status !== "pending") return { error: "申请不存在或已处理" };
  const ctx = await requireOrgAdmin(request.orgId);
  if (!ctx) return { error: "只有管理员可以审批" };

  if (decision === "approve") {
    if (await getMembership(request.orgId, request.userId)) {
      await db
        .update(joinRequests)
        .set({ status: "approved", handledAt: new Date() })
        .where(eq(joinRequests.id, requestId));
      refresh();
      return { ok: "对方已是成员" };
    }
    if ((await countUserOrgs(request.userId)) >= ORG_LIMITS.maxJoined) {
      return {
        error: `对方已加入 ${ORG_LIMITS.maxJoined} 个组织，名额已满，无法通过`,
      };
    }
    await db
      .insert(orgMembers)
      .values({ orgId: request.orgId, userId: request.userId, role: "member" });
    await db
      .update(joinRequests)
      .set({ status: "approved", handledAt: new Date() })
      .where(eq(joinRequests.id, requestId));
  } else {
    await db
      .update(joinRequests)
      .set({ status: "rejected", handledAt: new Date() })
      .where(eq(joinRequests.id, requestId));
  }
  await Promise.all([
    notify({
      userId: request.userId,
      type: decision === "approve" ? "org_join_approved" : "org_join_rejected",
      title: decision === "approve" ? `你已加入「${ctx.org.name}」` : `「${ctx.org.name}」暂未通过你的申请`,
      href: decision === "approve" ? `/orgs/${request.orgId}` : "/me?section=organization",
    }),
    track({
      name: decision === "approve" ? "org_join_approved" : "org_join_rejected",
      userId: request.userId,
      entityType: "org",
      entityId: request.orgId,
    }),
  ]);
  refresh();
  return {};
}

export async function promoteOrgAdminAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const orgId = Number(formData.get("orgId"));
  const userId = Number(formData.get("userId"));
  if (
    !Number.isInteger(orgId) ||
    orgId <= 0 ||
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return { error: "参数不正确" };
  }

  const ctx = await requireOrgAdmin(orgId);
  if (!ctx) return { error: "只有管理员可以任命管理员" };
  if (userId === ctx.user.id) return { error: "你已经是管理员" };

  const target = await getMembership(orgId, userId);
  if (!target) return { error: "该用户不是组织成员" };
  if (isOrgAdminRole(target.role)) return { ok: "对方已经是管理员" };

  // 把上限判断放进同一条 UPDATE，避免两位管理员同时操作时突破 3 人上限。
  const [promoted] = await db
    .update(orgMembers)
    .set({ role: "admin" })
    .where(
      and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.userId, userId),
        eq(orgMembers.role, "member"),
        sql`(
          SELECT COUNT(*)
          FROM ${orgMembers} AS org_admins
          WHERE org_admins.org_id = ${orgId}
            AND org_admins.role = 'admin'
        ) < ${ORG_LIMITS.maxAdmins}`,
      ),
    )
    .returning({ userId: orgMembers.userId });

  if (!promoted) {
    if ((await countOrgAdmins(orgId)) >= ORG_LIMITS.maxAdmins) {
      return {
        error: `每个组织最多任命 ${ORG_LIMITS.maxAdmins} 名管理员（拥有者另计）`,
      };
    }
    return { error: "任命失败，请刷新后重试" };
  }

  refresh();
  return { ok: "已设为管理员" };
}

export async function updateOrgAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const orgId = Number(formData.get("orgId"));
  if (!Number.isInteger(orgId)) return { error: "参数不正确" };
  const ctx = await requireOwner(orgId);
  if (!ctx) return { error: "只有组织拥有者可以编辑" };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "组织名称不能为空" };
  if (name.length > ORG_LIMITS.name)
    return { error: `组织名称最多 ${ORG_LIMITS.name} 字` };
  const description =
    String(formData.get("description") ?? "")
      .trim()
      .slice(0, ORG_LIMITS.description) || null;
  const visRaw = String(formData.get("visibility") ?? "private");
  await db
    .update(orgs)
    .set({
      name,
      description,
      visibility: visRaw === "public" ? "public" : "private",
    })
    .where(eq(orgs.id, orgId));
  refresh();
  return { ok: "已保存" };
}

export async function resetInviteCodeAction(formData: FormData) {
  const orgId = Number(formData.get("orgId"));
  if (!Number.isInteger(orgId)) return;
  const ctx = await requireOwner(orgId);
  if (!ctx) return;
  await db
    .update(orgs)
    .set({ inviteCode: await generateUniqueInviteCode() })
    .where(eq(orgs.id, orgId));
  refresh();
}

export async function removeMemberAction(formData: FormData) {
  const orgId = Number(formData.get("orgId"));
  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(orgId) || !Number.isInteger(userId)) return;
  const ctx = await requireOwner(orgId);
  if (!ctx || userId === ctx.user.id) return; // owner 不能移除自己
  await db
    .delete(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
  await closeUserOrgNeeds(userId, orgId);
  refresh();
}

export async function leaveOrgAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const orgId = Number(formData.get("orgId"));
  if (!Number.isInteger(orgId)) return;
  const membership = await getMembership(orgId, user.id);
  if (!membership || membership.role === "owner") return; // owner 只能解散
  await db
    .delete(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)));
  await closeUserOrgNeeds(user.id, orgId);
  redirect("/me?section=organization");
}

export async function dissolveOrgAction(formData: FormData) {
  const orgId = Number(formData.get("orgId"));
  if (!Number.isInteger(orgId)) return;
  const ctx = await requireOwner(orgId);
  if (!ctx) return;
  // 组织内需求、成员关系、待审批申请一并删除
  await db.delete(needs).where(eq(needs.orgId, orgId));
  await db.delete(orgMembers).where(eq(orgMembers.orgId, orgId));
  await db.delete(joinRequests).where(eq(joinRequests.orgId, orgId));
  await db.delete(orgs).where(eq(orgs.id, orgId));
  redirect("/me?section=organization");
}
