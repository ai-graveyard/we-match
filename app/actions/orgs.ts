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
import { getRequestDict, getRequestLocale } from "@/lib/i18n/request";
import { localePath } from "@/lib/i18n/routing";
import { fmt } from "@/lib/i18n/fmt";
import type { NotificationPayload } from "@/lib/notifications";

export type OrgFormState = { error?: string; ok?: string };

async function notifyOrgAdmins(orgId: number, payload: NotificationPayload) {
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
      notify({ userId, payload, href: `/orgs/${orgId}` }),
    ),
  );
}

export async function createOrgAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const t = await getRequestDict();
  const locale = await getRequestLocale();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.sessionExpired };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t.org.emptyName };
  if (name.length > ORG_LIMITS.name)
    return { error: fmt(t.org.nameTooLong, { max: ORG_LIMITS.name }) };
  const description =
    String(formData.get("description") ?? "")
      .trim()
      .slice(0, ORG_LIMITS.description) || null;
  const visRaw = String(formData.get("visibility") ?? "private");
  const visibility = visRaw === "public" ? "public" : "private";

  if ((await countUserOrgs(user.id)) >= ORG_LIMITS.maxJoined) {
    return {
      error: fmt(t.org.joinLimitWithCreate, { max: ORG_LIMITS.maxJoined }),
    };
  }

  const inviteCode = await generateUniqueInviteCode();
  const [org] = await db
    .insert(orgs)
    .values({ name, description, visibility, ownerId: user.id, inviteCode })
    .returning({ id: orgs.id });
  await db
    .insert(orgMembers)
    .values({ orgId: org.id, userId: user.id, role: "owner" });
  redirect(localePath(locale, `/orgs/${org.id}`));
}

// 两条申请路径共用的检查，返回 error 或 null
async function checkCanApply(
  userId: number,
  orgId: number,
  t: Awaited<ReturnType<typeof getRequestDict>>,
): Promise<string | null> {
  if (await getMembership(orgId, userId)) return t.org.alreadyMember;
  if ((await countUserOrgs(userId)) >= ORG_LIMITS.maxJoined)
    return fmt(t.org.joinLimit, { max: ORG_LIMITS.maxJoined });
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
  if (pending) return t.org.alreadyApplied;
  return null;
}

export async function applyByCodeAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.loginRequired };
  const code = normalizeInviteCode(String(formData.get("code") ?? ""));
  if (!code) return { error: t.org.emptyCode };
  if (
    !(await consumeRateLimit(
      `org-code:${user.id}`,
      ORG_LIMITS.codeAttemptsPerHour,
      60 * 60 * 1000,
    ))
  )
    return { error: t.org.codeTooManyAttempts };
  const [org] = await db
    .select({ id: orgs.id, name: orgs.name })
    .from(orgs)
    .where(eq(orgs.inviteCode, code))
    .limit(1);
  if (!org) {
    return { error: t.org.badCode };
  }
  const err = await checkCanApply(user.id, org.id, t);
  if (err) return { error: err };
  await db
    .insert(joinRequests)
    .values({ orgId: org.id, userId: user.id, via: "code" });
  await notifyOrgAdmins(org.id, {
    type: "org_join_requested",
    name: user.nickname,
    via: "code",
    orgId: org.id,
  });
  await track({ name: "org_join_requested", userId: user.id, entityType: "org", entityId: org.id });
  return { ok: fmt(t.org.appliedTo, { name: org.name }) };
}

export async function applyPlazaAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.loginRequired };
  const orgId = Number(formData.get("orgId"));
  if (!Number.isInteger(orgId) || orgId <= 0) return { error: t.common.badParams };
  const [org] = await db
    .select({ id: orgs.id, visibility: orgs.visibility })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);
  // 私有组织不接受广场申请（也不暴露存在性）
  if (!org || org.visibility !== "public") return { error: t.org.notFound };
  const err = await checkCanApply(user.id, orgId, t);
  if (err) return { error: err };
  await db
    .insert(joinRequests)
    .values({ orgId, userId: user.id, via: "plaza" });
  await notifyOrgAdmins(orgId, {
    type: "org_join_requested",
    name: user.nickname,
    via: "plaza",
    orgId,
  });
  await track({ name: "org_join_requested", userId: user.id, entityType: "org", entityId: orgId });
  refresh();
  return { ok: t.org.applied };
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
  const t = await getRequestDict();
  const requestId = Number(formData.get("requestId"));
  const decision = String(formData.get("decision"));
  if (!Number.isInteger(requestId) || !["approve", "reject"].includes(decision))
    return { error: t.common.badParams };
  const [request] = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.id, requestId))
    .limit(1);
  if (!request || request.status !== "pending") return { error: t.org.requestGone };
  const ctx = await requireOrgAdmin(request.orgId);
  if (!ctx) return { error: t.org.adminOnly };

  if (decision === "approve") {
    if (await getMembership(request.orgId, request.userId)) {
      await db
        .update(joinRequests)
        .set({ status: "approved", handledAt: new Date() })
        .where(eq(joinRequests.id, requestId));
      refresh();
      return { ok: t.org.targetAlreadyMember };
    }
    if ((await countUserOrgs(request.userId)) >= ORG_LIMITS.maxJoined) {
      return {
        error: fmt(t.org.targetJoinLimit, { max: ORG_LIMITS.maxJoined }),
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
      payload:
        decision === "approve"
          ? {
              type: "org_join_approved",
              org: ctx.org.name,
              orgId: request.orgId,
            }
          : { type: "org_join_rejected", org: ctx.org.name },
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
    return { error: (await getRequestDict()).common.badParams };
  }
  const t = await getRequestDict();

  const ctx = await requireOrgAdmin(orgId);
  if (!ctx) return { error: t.org.promoteAdminOnly };
  if (userId === ctx.user.id) return { error: t.org.selfAlreadyAdmin };

  const target = await getMembership(orgId, userId);
  if (!target) return { error: t.org.targetNotMember };
  if (isOrgAdminRole(target.role)) return { ok: t.org.targetAlreadyAdmin };

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
        error: fmt(t.org.adminLimit, { max: ORG_LIMITS.maxAdmins }),
      };
    }
    return { error: t.org.promoteFailed };
  }

  refresh();
  return { ok: t.org.promoted };
}

export async function updateOrgAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const t = await getRequestDict();
  const orgId = Number(formData.get("orgId"));
  if (!Number.isInteger(orgId)) return { error: t.common.badParams };
  const ctx = await requireOwner(orgId);
  if (!ctx) return { error: t.org.ownerOnly };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t.org.emptyName };
  if (name.length > ORG_LIMITS.name)
    return { error: fmt(t.org.nameTooLong, { max: ORG_LIMITS.name }) };
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
  return { ok: t.common.saved };
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
  redirect(localePath(await getRequestLocale(), "/me?section=organization"));
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
  redirect(localePath(await getRequestLocale(), "/me?section=organization"));
}
