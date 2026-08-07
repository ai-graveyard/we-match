"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import {
  applyNeedPatch,
  createNeed,
  deleteNeed,
  getOwnNeed,
  resolvePreferredContact,
  validateNeedPatch,
} from "@/lib/needs-service";
import { expiryFromPreset, hasDeadlinePassed } from "@/lib/needs";
import { getRequestDict, getRequestLocale } from "@/lib/i18n/request";
import { localePath } from "@/lib/i18n/routing";

export type NeedFormState = { error?: string };

// 表单值 → 服务层输入（标签是 JSON 字符串）
function formInput(formData: FormData): Record<string, unknown> | null {
  try {
    return {
      type: String(formData.get("type") ?? ""),
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      tags: JSON.parse(String(formData.get("tags") ?? "[]")) as unknown,
      preferredContact: String(formData.get("preferredContact") ?? ""),
      expiresAt:
        formData.get("permanent") === "1"
          ? null
          : String(formData.get("expiresAt") ?? ""),
    };
  } catch {
    return null;
  }
}

export async function createNeedAction(
  _prev: NeedFormState,
  formData: FormData,
): Promise<NeedFormState> {
  const t = await getRequestDict();
  const locale = await getRequestLocale();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.sessionExpired };

  const input = formInput(formData);
  if (!input) return { error: t.common.badTags };
  const parsed = validateNeedPatch(input, { requireCore: true }, t);
  if ("error" in parsed) return { error: parsed.error };

  // 可见范围：plaza 或组织 id；发布后不可改
  const scopeRaw = String(formData.get("scope") ?? "plaza");
  const orgId = scopeRaw === "plaza" ? null : Number(scopeRaw);
  const result = await createNeed(user, parsed.patch, orgId, t);
  if ("error" in result) return { error: result.error };
  redirect(localePath(locale, `/needs/${result.need.id}`));
}

export async function updateNeedAction(
  _prev: NeedFormState,
  formData: FormData,
): Promise<NeedFormState> {
  const t = await getRequestDict();
  const locale = await getRequestLocale();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.sessionExpired };
  const need = await getOwnNeed(user.id, Number(formData.get("id")));
  if (!need) return { error: t.need.notOwner };

  const input = formInput(formData);
  if (!input) return { error: t.common.badTags };
  const parsed = validateNeedPatch(input, { requireCore: true }, t);
  if ("error" in parsed) return { error: parsed.error };

  const preferredContact = resolvePreferredContact(
    user,
    need.orgId == null ? "plaza" : "org",
    parsed.patch.preferredContact,
  );
  if (!preferredContact) {
    return { error: t.need.noContactForScope };
  }

  // 可见范围不可改；内容和截止时间可编辑
  await applyNeedPatch(need, { ...parsed.patch, preferredContact });
  redirect(localePath(locale, `/needs/${need.id}`));
}

export async function setNeedStatusAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const status = String(formData.get("status"));
  if (status !== "open" && status !== "done" && status !== "closed") return;
  const need = await getOwnNeed(user.id, Number(formData.get("id")));
  if (!need) return;
  await applyNeedPatch(need, {
    status,
    ...(status === "open" && hasDeadlinePassed(need)
      ? { expiresAt: expiryFromPreset("month") }
      : {}),
  });
  refresh();
}

// 快速续期：将截止时间延长到一个月后
export async function refreshNeedAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const need = await getOwnNeed(user.id, Number(formData.get("id")));
  if (!need) return;
  await applyNeedPatch(need, { expiresAt: expiryFromPreset("month") });
  refresh();
}

export async function deleteNeedAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const need = await getOwnNeed(user.id, Number(formData.get("id")));
  if (!need) return;
  await deleteNeed(need);
  redirect(localePath(await getRequestLocale(), "/"));
}
