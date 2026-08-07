export const ORG_LIMITS = {
  name: 10,
  description: 500,
  maxJoined: 3, // 每人最多同时加入 3 个组织（自己创建的也计入）
  maxAdmins: 3, // 每个组织最多任命 3 名 admin，owner 另计但同样拥有管理员权限
  codeAttemptsPerHour: 10,
} as const;

export type OrgRole = "owner" | "admin" | "member";

export function isOrgAdminRole(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}

// 邀请码字符集：大写字母 + 数字，剔除易混淆的 0/O/1/I
export const INVITE_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase();
}
