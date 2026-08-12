import { verifyCode } from "@/lib/auth";
import { apiError, readJson, unknownJsonFields } from "@/lib/api/auth";
import { guardPublicAuthRoute } from "@/lib/api/auth-public";
import { createApiKey } from "@/lib/api-keys-service";
import { getMailProvider, maskEmail } from "@/lib/mail";
import { siteOrigin } from "@/lib/site-url";
import { audit } from "@/lib/activity";
import { getRequestDict } from "@/lib/i18n/request";
import { fmt } from "@/lib/i18n/fmt";

// POST /api/v1/auth/token：验证码换 API Key。首次出现的邮箱即注册。
//
// 这是 Agent-first 起步链路的最后一环——用户从没打开过网站也能拿到凭证。
// 换来的代价写在 docs/AGENT-SKILL.md 5：一封能读到的邮箱等于这个账号，
// 所以每次签发都发一封告知邮件，网页上的 Key 列表随时可删。
export async function POST(request: Request) {
  const limited = await guardPublicAuthRoute();
  if (limited) return limited;

  const t = await getRequestDict();
  const body = await readJson(request);
  if (!body) return apiError(422, "bad_body", t.api.bodyNotObject);
  const unknown = unknownJsonFields(body, ["email", "code", "name"]);
  if (unknown.length > 0) {
    return apiError(
      422,
      "unknown_fields",
      t.api.unknownFields.replace("{fields}", unknown.join(", ")),
    );
  }

  const email = typeof body.email === "string" ? body.email : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name
      : t.apiKey.agentDefaultName;

  const result = await verifyCode(email, code, t);
  if ("error" in result) return apiError(422, "bad_request", result.error);
  const { user, isNew } = result;

  // 满 3 个 Key 时这里会失败。不在 API 侧代删旧 Key：
  // 「API Key 不能管理 API Key」是防自我复制提权的底线，注册路径也不例外。
  const created = await createApiKey(user.id, name, t);
  if ("error" in created) {
    return apiError(422, "key_limit", created.error);
  }

  await audit({
    actorId: user.id,
    action: isNew ? "account_registered_via_api" : "api_key_issued_via_api",
    targetType: "user",
    targetId: user.id,
  });

  // 告知邮件是这条链路的审计通道，发失败不回滚 Key（Key 已经给出去了），只记日志
  try {
    const origin = await siteOrigin();
    await getMailProvider().send({
      to: user.loginEmail,
      subject: t.mail.keyIssuedSubject,
      text: fmt(t.mail.keyIssuedText, { name, origin }),
    });
  } catch (error) {
    console.error(
      `[MAIL] key-issued notice failed → ${maskEmail(user.loginEmail)}:`,
      error,
    );
  }

  return Response.json({
    key: created.secret,
    isNew,
    user: { id: user.id, nickname: user.nickname },
  });
}
