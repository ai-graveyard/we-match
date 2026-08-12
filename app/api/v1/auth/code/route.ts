import { requestVerificationCode } from "@/lib/auth";
import { apiError, readJson, unknownJsonFields } from "@/lib/api/auth";
import { guardPublicAuthRoute } from "@/lib/api/auth-public";
import { getRequestDict, getRequestLocale } from "@/lib/i18n/request";

// POST /api/v1/auth/code：给邮箱发一封验证码，供 Agent 代用户注册或登录。
// 无需 Key —— 用户此刻还没有账号。响应刻意不透露该邮箱是否已注册。
export async function POST(request: Request) {
  const limited = await guardPublicAuthRoute();
  if (limited) return limited;

  const t = await getRequestDict();
  const locale = await getRequestLocale();
  const body = await readJson(request);
  if (!body) return apiError(422, "bad_body", t.api.bodyNotObject);
  const unknown = unknownJsonFields(body, ["email"]);
  if (unknown.length > 0) {
    return apiError(
      422,
      "unknown_fields",
      t.api.unknownFields.replace("{fields}", unknown.join(", ")),
    );
  }

  const email = typeof body.email === "string" ? body.email : "";
  const { error } = await requestVerificationCode(email, t, locale);
  if (error) return apiError(422, "bad_request", error);

  return Response.json({ sent: true, expiresInSeconds: 300 });
}
