import { apiError, authenticate } from "@/lib/api/auth";
import { apiLimit, parseSince } from "@/lib/api/pagination";
import { serializeNeed } from "@/lib/api/serialize";
import { getRequestDict } from "@/lib/i18n/request";
import { getMatchCandidates } from "@/lib/matches";

// GET /api/v1/matches?need=<本人开放需求 id>&since=<ISO>&limit=<1..100>
// 平台只召回候选；最终语义判断和理由由端侧 Agent 基于私有画像完成。
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const params = new URL(request.url).searchParams;
  const t = await getRequestDict();

  const needId = Number(params.get("need"));
  if (!Number.isInteger(needId) || needId <= 0) {
    return apiError(422, "invalid_input", t.api.matchNeedParamNotId);
  }
  const since = parseSince(params.get("since"));
  if (since === "invalid") return apiError(422, "invalid_since", t.api.badSince);

  const result = await getMatchCandidates(auth.user.id, needId, {
    since,
    limit: apiLimit(params.get("limit"), 20),
  });
  if ("error" in result) {
    return result.error === "not_found"
      ? apiError(404, "not_found", t.api.needNotYours)
      : apiError(422, "source_not_open", t.api.matchSourceNotOpen);
  }

  return Response.json({
    sourceNeed: serializeNeed(result.source),
    matches: result.candidates.map((item) => ({
      candidate: serializeNeed(item.need, { author: item.author }),
      matchedTags: item.matchedTags,
    })),
  });
}
