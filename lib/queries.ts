import "server-only";
import crypto from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/lib/db";
import {
  connections,
  joinRequests,
  needs,
  orgMembers,
  orgs,
  users,
} from "@/lib/db/schema";
import { INVITE_CODE_CHARSET, INVITE_CODE_LENGTH } from "@/lib/orgs";

// 读模型：页面与 API 共用的查询。写路径见各 lib/*-service.ts。
// 命名约定：lib/X.ts = 常量 + 纯函数/校验，lib/X-service.ts = 有 IO 的写路径。

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

// 「我的 → 组织」卡片上的三个计数，按组织一次算齐
export async function getOrgOverviewStats(
  orgId: number,
  { withPendingRequests }: { withPendingRequests: boolean },
) {
  const [[membersRow], [openNeedsRow], [pendingRow]] = await Promise.all([
    db.select({ n: count() }).from(orgMembers).where(eq(orgMembers.orgId, orgId)),
    db
      .select({ n: count() })
      .from(needs)
      .where(
        and(
          eq(needs.orgId, orgId),
          eq(needs.status, "open"),
          or(isNull(needs.expiresAt), gt(needs.expiresAt, new Date())),
        ),
      ),
    withPendingRequests
      ? db
          .select({ n: count() })
          .from(joinRequests)
          .where(
            and(
              eq(joinRequests.orgId, orgId),
              eq(joinRequests.status, "pending"),
            ),
          )
      : Promise.resolve([{ n: 0 }]),
  ]);
  return {
    memberCount: membersRow?.n ?? 0,
    openNeedCount: openNeedsRow?.n ?? 0,
    pendingRequestCount: pendingRow?.n ?? 0,
  };
}

// 我发出的、还在等审批的组织申请
export async function getMyPendingJoinRequests(userId: number) {
  return db
    .select({ orgId: orgs.id, orgName: orgs.name })
    .from(joinRequests)
    .innerJoin(orgs, eq(joinRequests.orgId, orgs.id))
    .where(
      and(eq(joinRequests.userId, userId), eq(joinRequests.status, "pending")),
    )
    .orderBy(desc(joinRequests.createdAt));
}

// 某条需求上、当前访问者有权看到的举手：发布者看全部，举手方只看自己那条
export async function getNeedConnections(needId: number, viewerId: number, isOwner: boolean) {
  return db
    .select({ connection: connections, initiator: users })
    .from(connections)
    .innerJoin(users, eq(connections.initiatorId, users.id))
    .where(
      isOwner
        ? eq(connections.needId, needId)
        : and(
            eq(connections.needId, needId),
            eq(connections.initiatorId, viewerId),
          ),
    )
    .orderBy(desc(connections.updatedAt));
}

// 等我处理的举手，最久的排前面——它们是卡住发布与续期的那批
export async function getIncomingPendingHands(userId: number) {
  return db
    .select({
      id: connections.id,
      needId: connections.needId,
      needTitle: needs.title,
      otherName: users.nickname,
      status: connections.status,
      createdAt: connections.createdAt,
    })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .innerJoin(users, eq(connections.initiatorId, users.id))
    .where(and(eq(needs.userId, userId), eq(connections.status, "pending")))
    .orderBy(asc(connections.createdAt));
}

// 我发起的、还没结束的举手：等待回应、已无回应、已连接未完成
export async function getOutgoingHands(userId: number) {
  return db
    .select({
      id: connections.id,
      needId: connections.needId,
      needTitle: needs.title,
      otherName: users.nickname,
      status: connections.status,
      createdAt: connections.createdAt,
    })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .innerJoin(users, eq(needs.userId, users.id))
    .where(
      and(
        eq(connections.initiatorId, userId),
        inArray(connections.status, ["pending", "accepted"]),
      ),
    )
    .orderBy(asc(connections.createdAt));
}

// 「我的连接」中心的行。只下发展示所需字段：需求、对方、状态、时间、确认状态；
// 联系方式原值一律不出现在这里（接受后在需求详情页按揭示规则单独展示）。
export type ConnectionCenterRow = {
  id: number;
  needId: number;
  needTitle: string;
  otherId: number;
  otherName: string;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
  createdAt: Date;
  ownerConfirmedAt: Date | null;
  initiatorConfirmedAt: Date | null;
};

// pending 置顶，其余按最近更新排。发布者要先看到「等我处理」的那批。
const pendingFirst = sql`CASE WHEN ${connections.status} = 'pending' THEN 0 ELSE 1 END`;

// 收到：别人对「我发布的需求」举手（我是发布者）
export async function getReceivedConnections(
  userId: number,
): Promise<ConnectionCenterRow[]> {
  return db
    .select({
      id: connections.id,
      needId: connections.needId,
      needTitle: needs.title,
      otherId: users.id,
      otherName: users.nickname,
      message: connections.message,
      status: connections.status,
      createdAt: connections.createdAt,
      ownerConfirmedAt: connections.ownerConfirmedAt,
      initiatorConfirmedAt: connections.initiatorConfirmedAt,
    })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .innerJoin(users, eq(connections.initiatorId, users.id))
    .where(eq(needs.userId, userId))
    .orderBy(pendingFirst, desc(connections.updatedAt));
}

// 发起：我对「别人的需求」举手（我是举手方）
export async function getInitiatedConnections(
  userId: number,
): Promise<ConnectionCenterRow[]> {
  return db
    .select({
      id: connections.id,
      needId: connections.needId,
      needTitle: needs.title,
      otherId: users.id,
      otherName: users.nickname,
      message: connections.message,
      status: connections.status,
      createdAt: connections.createdAt,
      ownerConfirmedAt: connections.ownerConfirmedAt,
      initiatorConfirmedAt: connections.initiatorConfirmedAt,
    })
    .from(connections)
    .innerJoin(needs, eq(connections.needId, needs.id))
    .innerJoin(users, eq(needs.userId, users.id))
    .where(eq(connections.initiatorId, userId))
    .orderBy(pendingFirst, desc(connections.updatedAt));
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
