import "server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  connections,
  contactReveals,
  joinRequests,
  needs,
  orgMembers,
  orgs,
  type User,
} from "@/lib/db/schema";
import { ORG_LIMITS, isOrgAdminRole } from "@/lib/orgs";
import {
  closeUserOrgNeeds,
  countOrgAdmins,
  countUserOrgs,
  generateUniqueInviteCode,
  getMembership,
} from "@/lib/queries";
import { notify, track } from "@/lib/activity";
import { checkQuota } from "@/lib/quota";
import { consumeRateLimit } from "@/lib/rate-limit";
import { fmt } from "@/lib/i18n/fmt";
import type { ServerDict } from "@/lib/i18n/dict/types";
import type { NotificationPayload } from "@/lib/notifications";

// 组织写路径：网页表单与后续开放 API 共用的校验与落库层

type Actor = Pick<User, "id" | "nickname">;

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

async function checkCanApply(
  user: User,
  orgId: number,
  t: ServerDict,
): Promise<string | null> {
  if (await getMembership(orgId, user.id)) return t.org.alreadyMember;
  if ((await countUserOrgs(user.id)) >= ORG_LIMITS.maxJoined)
    return fmt(t.org.joinLimit, { max: ORG_LIMITS.maxJoined });
  const [pending] = await db
    .select({ id: joinRequests.id })
    .from(joinRequests)
    .where(
      and(
        eq(joinRequests.orgId, orgId),
        eq(joinRequests.userId, user.id),
        eq(joinRequests.status, "pending"),
      ),
    )
    .limit(1);
  if (pending) return t.org.alreadyApplied;
  const quota = await checkQuota(user, "org.join", t);
  if (!quota.ok) return quota.message;
  return null;
}

async function requireOwner(userId: number, orgId: number) {
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
  if (!org || org.ownerId !== userId) return null;
  return org;
}

async function requireOrgAdmin(userId: number, orgId: number) {
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
  if (!org) return null;
  const membership = await getMembership(orgId, userId);
  if (!membership || !isOrgAdminRole(membership.role)) return null;
  return { org, membership };
}

export async function createOrg(
  user: User,
  input: { name: string; description: string | null; visibility: "public" | "private" },
  t: ServerDict,
): Promise<{ error: string } | { orgId: number }> {
  const name = input.name.trim();
  if (!name) return { error: t.org.emptyName };
  if (name.length > ORG_LIMITS.name)
    return { error: fmt(t.org.nameTooLong, { max: ORG_LIMITS.name }) };
  const description = input.description?.trim().slice(0, ORG_LIMITS.description) || null;

  if ((await countUserOrgs(user.id)) >= ORG_LIMITS.maxJoined) {
    return {
      error: fmt(t.org.joinLimitWithCreate, { max: ORG_LIMITS.maxJoined }),
    };
  }

  const quota = await checkQuota(user, "org.create", t);
  if (!quota.ok) return { error: quota.message };

  const inviteCode = await generateUniqueInviteCode();
  const [org] = await db
    .insert(orgs)
    .values({
      name,
      description,
      visibility: input.visibility,
      ownerId: user.id,
      inviteCode,
    })
    .returning({ id: orgs.id });
  await db
    .insert(orgMembers)
    .values({ orgId: org.id, userId: user.id, role: "owner" });
  return { orgId: org.id };
}

export async function applyByCode(
  user: User,
  code: string,
  t: ServerDict,
): Promise<{ error: string } | { orgName: string }> {
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
  const err = await checkCanApply(user, org.id, t);
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
  await track({
    name: "org_join_requested",
    userId: user.id,
    entityType: "org",
    entityId: org.id,
  });
  return { orgName: org.name };
}

export async function applyPlaza(
  user: User,
  orgId: number,
  t: ServerDict,
): Promise<{ error: string } | { ok: true }> {
  if (!Number.isInteger(orgId) || orgId <= 0) return { error: t.common.badParams };
  const [org] = await db
    .select({ id: orgs.id, visibility: orgs.visibility })
    .from(orgs)
    .where(eq(orgs.id, orgId))
    .limit(1);
  // 私有组织不接受广场申请（也不暴露存在性）
  if (!org || org.visibility !== "public") return { error: t.org.notFound };
  const err = await checkCanApply(user, orgId, t);
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
  await track({
    name: "org_join_requested",
    userId: user.id,
    entityType: "org",
    entityId: orgId,
  });
  return { ok: true };
}

export async function handleJoinRequest(
  user: Actor,
  input: { requestId: number; decision: "approve" | "reject" },
  t: ServerDict,
): Promise<{ error: string } | { ok?: string }> {
  const { requestId, decision } = input;
  if (!Number.isInteger(requestId) || !["approve", "reject"].includes(decision))
    return { error: t.common.badParams };
  const [request] = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.id, requestId))
    .limit(1);
  if (!request || request.status !== "pending") return { error: t.org.requestGone };
  const ctx = await requireOrgAdmin(user.id, request.orgId);
  if (!ctx) return { error: t.org.adminOnly };

  if (decision === "approve") {
    if (await getMembership(request.orgId, request.userId)) {
      await db
        .update(joinRequests)
        .set({ status: "approved", handledAt: new Date() })
        .where(eq(joinRequests.id, requestId));
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
  return {};
}

export async function promoteOrgAdmin(
  user: Actor,
  input: { orgId: number; userId: number },
  t: ServerDict,
): Promise<{ error: string } | { ok: string }> {
  const { orgId, userId } = input;
  if (
    !Number.isInteger(orgId) ||
    orgId <= 0 ||
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return { error: t.common.badParams };
  }

  const ctx = await requireOrgAdmin(user.id, orgId);
  if (!ctx) return { error: t.org.promoteAdminOnly };
  if (userId === user.id) return { error: t.org.selfAlreadyAdmin };

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

  return { ok: t.org.promoted };
}

export async function updateOrg(
  user: Actor,
  input: {
    orgId: number;
    name: string;
    description: string | null;
    visibility: "public" | "private";
  },
  t: ServerDict,
): Promise<{ error: string } | { ok: true }> {
  const { orgId } = input;
  if (!Number.isInteger(orgId)) return { error: t.common.badParams };
  if (!(await requireOwner(user.id, orgId))) return { error: t.org.ownerOnly };
  const name = input.name.trim();
  if (!name) return { error: t.org.emptyName };
  if (name.length > ORG_LIMITS.name)
    return { error: fmt(t.org.nameTooLong, { max: ORG_LIMITS.name }) };
  const description = input.description?.trim().slice(0, ORG_LIMITS.description) || null;
  await db
    .update(orgs)
    .set({
      name,
      description,
      visibility: input.visibility,
    })
    .where(eq(orgs.id, orgId));
  return { ok: true };
}

export async function resetInviteCode(
  user: Actor,
  orgId: number,
): Promise<{ ok: true } | null> {
  if (!Number.isInteger(orgId)) return null;
  if (!(await requireOwner(user.id, orgId))) return null;
  await db
    .update(orgs)
    .set({ inviteCode: await generateUniqueInviteCode() })
    .where(eq(orgs.id, orgId));
  return { ok: true };
}

export async function removeMember(
  user: Actor,
  input: { orgId: number; userId: number },
): Promise<{ ok: true } | null> {
  const { orgId, userId } = input;
  if (!Number.isInteger(orgId) || !Number.isInteger(userId)) return null;
  if (!(await requireOwner(user.id, orgId)) || userId === user.id) return null;
  await db
    .delete(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
  await closeUserOrgNeeds(userId, orgId);
  return { ok: true };
}

export async function leaveOrg(
  user: Actor,
  orgId: number,
): Promise<{ ok: true } | null> {
  if (!Number.isInteger(orgId)) return null;
  const membership = await getMembership(orgId, user.id);
  if (!membership || membership.role === "owner") return null;
  await db
    .delete(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)));
  await closeUserOrgNeeds(user.id, orgId);
  return { ok: true };
}

export async function dissolveOrg(
  user: Actor,
  orgId: number,
): Promise<{ ok: true } | null> {
  if (!Number.isInteger(orgId)) return null;
  if (!(await requireOwner(user.id, orgId))) return null;
  // 组织内需求下可能挂着举手与联系方式揭示（connections/contact_reveals 都有
  // 指向 needs 的外键）。必须先按外键依赖顺序清掉这些子图，否则直接删 needs
  // 会外键失败。整个解散放进单个 IMMEDIATE 事务，任一步失败都回滚。
  db.transaction(
    (tx) => {
      const orgNeedIds = tx
        .select({ id: needs.id })
        .from(needs)
        .where(eq(needs.orgId, orgId))
        .all()
        .map((row) => row.id);
      if (orgNeedIds.length > 0) {
        tx
          .delete(contactReveals)
          .where(inArray(contactReveals.needId, orgNeedIds))
          .run();
        tx.delete(connections).where(inArray(connections.needId, orgNeedIds)).run();
        tx.delete(needs).where(inArray(needs.id, orgNeedIds)).run();
      }
      tx.delete(orgMembers).where(eq(orgMembers.orgId, orgId)).run();
      tx.delete(joinRequests).where(eq(joinRequests.orgId, orgId)).run();
      tx.delete(orgs).where(and(eq(orgs.id, orgId), eq(orgs.ownerId, user.id))).run();
    },
    { behavior: "immediate" },
  );
  return { ok: true };
}
