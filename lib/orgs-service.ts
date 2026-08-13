import "server-only";
import { and, count, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  auditLogs,
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

function insertJoinRequestAtomic(
  userId: number,
  orgId: number,
  via: "code" | "plaza",
  t: ServerDict,
): string | null {
  return db.transaction(
    (tx) => {
      const membership = tx
        .select({ userId: orgMembers.userId })
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
        .limit(1)
        .all()[0];
      if (membership) return t.org.alreadyMember;
      const joined = tx
        .select({ n: count() })
        .from(orgMembers)
        .where(eq(orgMembers.userId, userId))
        .all()[0];
      if ((joined?.n ?? 0) >= ORG_LIMITS.maxJoined) {
        return fmt(t.org.joinLimit, { max: ORG_LIMITS.maxJoined });
      }
      const pending = tx
        .select({ id: joinRequests.id })
        .from(joinRequests)
        .where(
          and(
            eq(joinRequests.orgId, orgId),
            eq(joinRequests.userId, userId),
            eq(joinRequests.status, "pending"),
          ),
        )
        .limit(1)
        .all()[0];
      if (pending) return t.org.alreadyApplied;
      tx.insert(joinRequests).values({ orgId, userId, via }).run();
      return null;
    },
    { behavior: "immediate" },
  );
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
  return db.transaction(
    (tx): { error: string } | { orgId: number } => {
      const joined = tx
        .select({ n: count() })
        .from(orgMembers)
        .where(eq(orgMembers.userId, user.id))
        .all()[0];
      if ((joined?.n ?? 0) >= ORG_LIMITS.maxJoined) {
        return {
          error: fmt(t.org.joinLimitWithCreate, { max: ORG_LIMITS.maxJoined }),
        };
      }
      const org = tx
        .insert(orgs)
        .values({
          name,
          description,
          visibility: input.visibility,
          ownerId: user.id,
          inviteCode,
        })
        .returning({ id: orgs.id })
        .all()[0];
      tx.insert(orgMembers)
        .values({ orgId: org.id, userId: user.id, role: "owner" })
        .run();
      return { orgId: org.id };
    },
    { behavior: "immediate" },
  );
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
  const writeError = insertJoinRequestAtomic(user.id, org.id, "code", t);
  if (writeError) return { error: writeError };
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
  const writeError = insertJoinRequestAtomic(user.id, orgId, "plaza", t);
  if (writeError) return { error: writeError };
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
  const result = db.transaction(
    (
      tx,
    ):
      | { error: string }
      | {
          request: typeof joinRequests.$inferSelect;
          orgName: string;
          alreadyMember: boolean;
        } => {
      const request = tx
        .select()
        .from(joinRequests)
        .where(eq(joinRequests.id, requestId))
        .limit(1)
        .all()[0];
      if (!request || request.status !== "pending") {
        return { error: t.org.requestGone };
      }
      const org = tx
        .select()
        .from(orgs)
        .where(eq(orgs.id, request.orgId))
        .limit(1)
        .all()[0];
      const membership = tx
        .select()
        .from(orgMembers)
        .where(
          and(eq(orgMembers.orgId, request.orgId), eq(orgMembers.userId, user.id)),
        )
        .limit(1)
        .all()[0];
      if (!org || !membership || !isOrgAdminRole(membership.role)) {
        return { error: t.org.adminOnly };
      }

      const now = new Date();
      if (decision === "approve") {
        const existing = tx
          .select({ userId: orgMembers.userId })
          .from(orgMembers)
          .where(
            and(
              eq(orgMembers.orgId, request.orgId),
              eq(orgMembers.userId, request.userId),
            ),
          )
          .limit(1)
          .all()[0];
        if (existing) {
          tx.update(joinRequests)
            .set({ status: "approved", handledAt: now })
            .where(
              and(
                eq(joinRequests.id, requestId),
                eq(joinRequests.status, "pending"),
              ),
            )
            .run();
          return {
            request,
            orgName: org.name,
            alreadyMember: true,
          };
        }
        const joined = tx
          .select({ n: count() })
          .from(orgMembers)
          .where(eq(orgMembers.userId, request.userId))
          .all()[0];
        if ((joined?.n ?? 0) >= ORG_LIMITS.maxJoined) {
          return {
            error: fmt(t.org.targetJoinLimit, { max: ORG_LIMITS.maxJoined }),
          };
        }
        tx.insert(orgMembers)
          .values({ orgId: request.orgId, userId: request.userId, role: "member" })
          .run();
      }
      tx.update(joinRequests)
        .set({
          status: decision === "approve" ? "approved" : "rejected",
          handledAt: now,
        })
        .where(
          and(eq(joinRequests.id, requestId), eq(joinRequests.status, "pending")),
        )
        .run();
      return { request, orgName: org.name, alreadyMember: false };
    },
    { behavior: "immediate" },
  );
  if ("error" in result) return { error: result.error };
  if (result.alreadyMember) return { ok: t.org.targetAlreadyMember };
  const { request, orgName } = result;
  await Promise.all([
    notify({
      userId: request.userId,
      payload:
        decision === "approve"
          ? {
              type: "org_join_approved",
              org: orgName,
              orgId: request.orgId,
            }
          : { type: "org_join_rejected", org: orgName },
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
  // 组织解散后撤下需求，但保留连接与联系方式揭示台账，避免配额和调查证据丢失。
  // needs.org_id 没有外键，允许保留原组织 ID 作为历史关联。
  db.transaction(
    (tx) => {
      const now = new Date();
      const archivedNeeds = tx
        .update(needs)
        .set({ status: "closed", deletedAt: now, updatedAt: now })
        .where(eq(needs.orgId, orgId))
        .returning({ id: needs.id })
        .all();
      tx.insert(auditLogs)
        .values({
          actorId: user.id,
          action: "org_dissolved",
          targetType: "org",
          targetId: orgId,
          metadata: { archivedNeedCount: archivedNeeds.length },
        })
        .run();
      tx.delete(orgMembers).where(eq(orgMembers.orgId, orgId)).run();
      tx.delete(joinRequests).where(eq(joinRequests.orgId, orgId)).run();
      tx.delete(orgs).where(and(eq(orgs.id, orgId), eq(orgs.ownerId, user.id))).run();
    },
    { behavior: "immediate" },
  );
  return { ok: true };
}
