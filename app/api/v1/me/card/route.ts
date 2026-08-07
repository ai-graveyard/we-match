import { apiError, authenticate, readJson } from "@/lib/api/auth";
import { serializeSelf } from "@/lib/api/serialize";
import { applyCardPatch, validateCardPatch } from "@/lib/card-service";
import { getRequestDict } from "@/lib/i18n/request";

// PATCH /api/v1/me/card：部分更新名片字段与可见性。
// fieldVisibility 为整体替换（先 GET /api/v1/me 取当前值再改）
export async function PATCH(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;

  const body = await readJson(request);
  const t = await getRequestDict();
  if (!body) return apiError(422, "invalid_body", t.api.bodyNotObject);
  const parsed = validateCardPatch(body, t);
  if ("error" in parsed) return apiError(422, "invalid_input", parsed.error);

  const { user, warning } = await applyCardPatch(auth.user, parsed.patch, t);
  return Response.json({ card: serializeSelf(user), warning: warning ?? null });
}
