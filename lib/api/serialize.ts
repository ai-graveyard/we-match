import type { Need, Org, User } from "@/lib/db/schema";
import { isExpired } from "@/lib/needs";
import type { OrgRole } from "@/lib/orgs";
import { normalizedFieldVisibility } from "@/lib/card";

// 对外序列化：时间转 ISO 字符串；登录手机号 phone 永不出站（docs/AGENT-SKILL.md 2.2）

export function serializeNeed(
  need: Need,
  extra: {
    orgName?: string | null;
    author?: { id: number; nickname: string };
  } = {},
) {
  return {
    id: need.id,
    type: need.type,
    title: need.title,
    description: need.description,
    tags: need.tags,
    preferredContact: need.preferredContact,
    orgId: need.orgId,
    orgName: need.orgId != null ? (extra.orgName ?? null) : null,
    status: need.status,
    expired: isExpired(need),
    expiresAt: need.expiresAt?.toISOString() ?? null,
    author: extra.author,
    createdAt: need.createdAt.toISOString(),
    updatedAt: need.updatedAt.toISOString(),
  };
}

// 本人视角的名片全量：含每个字段与可见性设置，供 Agent 读改
export function serializeSelf(user: User) {
  return {
    id: user.id,
    nickname: user.nickname,
    bio: user.bio,
    city: user.city,
    tags: user.tags,
    wechat: user.wechat,
    email: user.email,
    contactPhone: user.contactPhone,
    weixinMp: user.weixinMp,
    weixinChannels: user.weixinChannels,
    xiaohongshu: user.xiaohongshu,
    weibo: user.weibo,
    fieldVisibility: normalizedFieldVisibility(user.fieldVisibility),
    createdAt: user.createdAt.toISOString(),
  };
}

// 组织概要：邀请码等 owner 专属信息不出站（v1 不开放 owner 管理）
export function serializeOrg(org: Org, role?: OrgRole) {
  return {
    id: org.id,
    name: org.name,
    description: org.description,
    visibility: org.visibility,
    role,
    createdAt: org.createdAt.toISOString(),
  };
}
