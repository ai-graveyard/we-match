"use server";

import { getSessionUser } from "@/lib/auth";
import { applyCardPatch, validateCardPatch } from "@/lib/card-service";
import {
  BASIC_FIELDS,
  CONTACT_FIELDS,
  SOCIAL_FIELDS,
  fieldVisibility,
} from "@/lib/card";
import { getRequestDict } from "@/lib/i18n/request";

export type CardFormState = {
  error?: string;
  saved?: boolean;
  warning?: string;
  savedAt?: number;
};

export async function updateCardAction(
  _prev: CardFormState,
  formData: FormData,
): Promise<CardFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.sessionExpired };

  // 表单是全量替换：每个字段与每项可见性都提交
  let tags: unknown;
  try {
    tags = JSON.parse(String(formData.get("tags") ?? "[]"));
  } catch {
    return { error: t.common.badTags };
  }
  const submittedVisibility: Record<string, unknown> = {};
  for (const f of [...BASIC_FIELDS, ...CONTACT_FIELDS, ...SOCIAL_FIELDS]) {
    submittedVisibility[f.key] = String(
      formData.get(`vis_${f.key}`) ?? fieldVisibility({}, f.key),
    );
  }
  const input: Record<string, unknown> = {
    nickname: formData.get("nickname"),
    bio: formData.get("bio"),
    city: formData.get("city"),
    tags,
    wechat: formData.get("wechat"),
    email: formData.get("email"),
    contactPhone: formData.get("contactPhone"),
    weixinMp: formData.get("weixinMp"),
    weixinChannels: formData.get("weixinChannels"),
    xiaohongshu: formData.get("xiaohongshu"),
    weibo: formData.get("weibo"),
    fieldVisibility: submittedVisibility,
  };

  const parsed = validateCardPatch(input, t);
  if ("error" in parsed) return { error: parsed.error };
  const { warning } = await applyCardPatch(user, parsed.patch, t);
  return { saved: true, warning, savedAt: Date.now() };
}
