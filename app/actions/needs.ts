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
import { validatePublishingContact } from "@/lib/publishing-contact";

export type NeedFormState = { error?: string };

function draftReceipt(formData: FormData): string {
  const token = String(formData.get("draftToken") ?? "");
  return /^[\da-f-]{36}$/i.test(token) ? `&draft=${encodeURIComponent(token)}` : "";
}

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
  const inline = formData.get("inlineContactField")
    ? validatePublishingContact({ nickname: formData.get("nickname"), field: formData.get("inlineContactField"), value: formData.get("inlineContactValue") }, t)
    : null;
  if (inline && "error" in inline) return inline;
  const result = await createNeed(user, parsed.patch, orgId, t, {
    publishingContact: inline && "contact" in inline ? inline.contact : undefined,
  });
  if ("error" in result) return { error: result.error };
  redirect(localePath(locale, `/needs/${result.need.id}?published=1${draftReceipt(formData)}`));
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
  const applied = await applyNeedPatch(need, { ...parsed.patch, preferredContact }, t);
  if ("error" in applied) return { error: applied.error };
  redirect(localePath(locale, `/needs/${need.id}?saved=1${draftReceipt(formData)}`));
}

export async function setNeedStatusAction(
  _prev: NeedFormState,
  formData: FormData,
): Promise<NeedFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.sessionExpired };
  const status = String(formData.get("status"));
  if (status !== "open" && status !== "done" && status !== "closed") return {};
  const need = await getOwnNeed(user.id, Number(formData.get("id")));
  if (!need) return { error: t.need.notOwner };
  const applied = await applyNeedPatch(
    need,
    {
      status,
      ...(status === "open" && hasDeadlinePassed(need)
        ? { expiresAt: expiryFromPreset("month") }
        : {}),
    },
    t,
  );
  if ("error" in applied) return { error: applied.error };
  refresh();
  return {};
}

// 快速续期：将截止时间延长到一个月后
export async function refreshNeedAction(
  _prev: NeedFormState,
  formData: FormData,
): Promise<NeedFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.sessionExpired };
  const need = await getOwnNeed(user.id, Number(formData.get("id")));
  if (!need) return { error: t.need.notOwner };
  const applied = await applyNeedPatch(
    need,
    { expiresAt: expiryFromPreset("month") },
    t,
  );
  if ("error" in applied) return { error: applied.error };
  refresh();
  return {};
}

export async function deleteNeedAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const need = await getOwnNeed(user.id, Number(formData.get("id")));
  if (!need) return;
  await deleteNeed(need);
  redirect(localePath(await getRequestLocale(), "/"));
}
