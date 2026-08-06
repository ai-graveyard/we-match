import "server-only";
import crypto from "node:crypto";
import { and, count, eq, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/lib/db";
import { needs, orgMembers, orgs, users } from "@/lib/db/schema";
import { INVITE_CODE_CHARSET, INVITE_CODE_LENGTH } from "@/lib/orgs";

// 访问者与名片主人是否同属至少一个组织（「共同组织可见」的判定）
export async function sharesOrg(
  viewerId: number,
  ownerId: number,
): Promise<boolean> {
  if (viewerId === ownerId) return true;
  const other = alias(orgMembers, "other");
  const [row] = await db
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .innerJoin(other, eq(orgMembers.orgId, other.orgId))
    .where(and(eq(orgMembers.userId, viewerId), eq(other.userId, ownerId)))
    .limit(1);
  return !!row;
}

// 已加入的组织数（含自己创建的），用于 3 个上限校验
export async function countUserOrgs(userId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId));
  return row?.n ?? 0;
}

export async function getMembership(orgId: number, userId: number) {
  const [row] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
    .limit(1);
  return row ?? null;
}

// 已任命的 admin 数量；唯一 owner 另计，但同样拥有管理员权限。
export async function countOrgAdmins(orgId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, "admin")));
  return row?.n ?? 0;
}

// 我加入的组织列表（含角色）
export async function getUserOrgs(userId: number) {
  return db
    .select({ org: orgs, role: orgMembers.role })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgMembers.orgId, orgs.id))
    .where(eq(orgMembers.userId, userId))
    .orderBy(orgMembers.joinedAt);
}

// 全局唯一邀请码
export async function generateUniqueInviteCode(): Promise<string> {
  for (;;) {
    let code = "";
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += INVITE_CODE_CHARSET[crypto.randomInt(INVITE_CODE_CHARSET.length)];
    }
    const [exists] = await db
      .select({ id: orgs.id })
      .from(orgs)
      .where(eq(orgs.inviteCode, code))
      .limit(1);
    if (!exists) return code;
  }
}

// 退出/被移除的连带处理：该成员在该组织的需求自动置为「已关闭」
export async function closeUserOrgNeeds(userId: number, orgId: number) {
  await db
    .update(needs)
    .set({ status: "closed", updatedAt: new Date() })
    .where(and(eq(needs.userId, userId), eq(needs.orgId, orgId)));
}

// 标签词库：名片标签 + 需求标签的并集，按使用频次排序（联想复用，避免同义词分裂）
export async function getAllTags(): Promise<string[]> {
  const userRows = await db
    .select({ tags: users.tags })
    .from(users)
    .where(ne(users.tags, []));
  const needRows = await db
    .select({ tags: needs.tags })
    .from(needs)
    .where(ne(needs.tags, []));
  const freq = new Map<string, number>();
  for (const row of [...userRows, ...needRows]) {
    for (const tag of row.tags) {
      freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh"))
    .map(([tag]) => tag);
}
