// 管理后台访问控制：生产环境必须配置 ADMIN_PHONES（逗号分隔的手机号名单）；
// 未配置时仅开发环境放行任意登录用户，生产一律拒绝
export function isAdmin(user: { phone: string }): boolean {
  const list = process.env.ADMIN_PHONES?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list?.length) return list.includes(user.phone);
  return process.env.NODE_ENV !== "production";
}
