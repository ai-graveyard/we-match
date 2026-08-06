import { apiError, authenticate, readJson } from "@/lib/api/auth";
import { serializeSelf } from "@/lib/api/serialize";
import { applyCardPatch, validateCardPatch } from "@/lib/card-service";

// PATCH /api/v1/me/card：部分更新名片字段与可见性。
// fieldVisibility 为整体替换（先 GET /api/v1/me 取当前值再改）
export async function PATCH(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;

  const body = await readJson(request);
  if (!body) return apiError(422, "invalid_body", "请求体需为 JSON 对象");
  const parsed = validateCardPatch(body);
  if ("error" in parsed) return apiError(422, "invalid_input", parsed.error);

  const { user, warning } = await applyCardPatch(auth.user, parsed.patch);
  return Response.json({ card: serializeSelf(user), warning: warning ?? null });
}
