// 管理后台访问控制：生产环境必须配置 ADMIN_EMAILS（逗号分隔的登录邮箱名单）；
// 未配置时仅开发环境放行任意登录用户，生产一律拒绝
export function isAdmin(user: { loginEmail: string }): boolean {
  const list = process.env.ADMIN_EMAILS?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list?.length) return list.includes(user.loginEmail);
  return process.env.NODE_ENV !== "production";
}
