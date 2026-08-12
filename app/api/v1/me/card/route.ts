import {
  apiError,
  authenticate,
  readJson,
  unknownJsonFields,
} from "@/lib/api/auth";
import { serializeSelf } from "@/lib/api/serialize";
import { applyCardPatch, validateCardPatch } from "@/lib/card-service";
import { normalizedFieldVisibility } from "@/lib/card";
import { getRequestDict } from "@/lib/i18n/request";
import { audit } from "@/lib/activity";

// PATCH /api/v1/me/card：部分更新名片字段与可见性。
// fieldVisibility 按键合并，避免 Agent 的读改写覆盖网页端并发变更。
export async function PATCH(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;

  const body = await readJson(request);
  const t = await getRequestDict();
  if (!body) return apiError(422, "invalid_body", t.api.bodyNotObject);
  const unknown = unknownJsonFields(body, [
    "nickname",
    "bio",
    "city",
    "tags",
    "wechat",
    "email",
    "contactPhone",
    "weixinMp",
    "weixinChannels",
    "xiaohongshu",
    "weibo",
    "fieldVisibility",
  ]);
  if (unknown.length > 0) {
    return apiError(
      422,
      "unknown_fields",
      t.api.unknownFields.replace("{fields}", unknown.join(", ")),
    );
  }
  const parsed = validateCardPatch(body, t, { preserveVisibilityDefaults: true });
  if ("error" in parsed) return apiError(422, "invalid_input", parsed.error);
  if (parsed.patch.fieldVisibility) {
    // API 是逐键合并：Agent 不需要 GET→整体替换，也不会覆盖网页端同时修改的其他键。
    parsed.patch.fieldVisibility = normalizedFieldVisibility({
      ...auth.user.fieldVisibility,
      ...parsed.patch.fieldVisibility,
    });
  }

  const { user, warning } = await applyCardPatch(auth.user, parsed.patch, t);
  await audit({
    actorId: auth.user.id,
    action: "agent_card_updated",
    targetType: "user",
    targetId: auth.user.id,
    metadata: { apiKeyId: auth.apiKeyId, fields: Object.keys(body) },
  });
  return Response.json({ card: serializeSelf(user), warning: warning ?? null });
}
