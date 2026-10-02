import { NEED_LIMITS, EXPIRY_PRESETS } from "@/lib/needs";
import type { NeedFormInitial } from "@/components/need-form";

export function needDraftKey(userId: number, needId?: number) {
  return `wm:need-draft:${userId}:${needId ? `edit:${needId}` : "new"}`;
}

export function publishedDraftMatches(raw: string | null, token: string | null): boolean {
  if (!raw || !token) return false;
  try { return JSON.parse(raw).token === token; } catch { return false; }
}

// 联系方式原值不写入浏览器草稿。旧账号、别的需求和非法数据不能恢复到本表单。
export function parseNeedDraft(raw: string | null, initial: NeedFormInitial, scopes: string[]): NeedFormInitial | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    if (draft.version !== 1 || !draft.fields || draft.fields.id !== initial.id) return null;
    const f = draft.fields;
    if ((f.type !== "need" && f.type !== "offer") || typeof f.title !== "string" || f.title.length > NEED_LIMITS.title || typeof f.description !== "string" || f.description.length > NEED_LIMITS.description) return null;
    if (!Array.isArray(f.tags) || f.tags.length > NEED_LIMITS.tagCount || f.tags.some((tag: unknown) => typeof tag !== "string" || tag.length > NEED_LIMITS.tagLength)) return null;
    if (!scopes.includes(f.scope) || (initial.id && f.scope !== initial.scope)) return null;
    if (f.expiresAt !== null && (typeof f.expiresAt !== "string" || !Number.isFinite(Date.parse(f.expiresAt)))) return null;
    if (f.expiryPreset !== "custom" && !EXPIRY_PRESETS.some((preset) => preset.value === f.expiryPreset)) return null;
    return { ...initial, type: f.type, title: f.title, description: f.description, tags: f.tags, scope: f.scope, expiresAt: f.expiresAt, expiryPreset: f.expiryPreset === "custom" ? undefined : f.expiryPreset };
  } catch { return null; }
}
