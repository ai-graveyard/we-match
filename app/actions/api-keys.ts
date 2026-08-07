"use server";

import { refresh } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { createApiKey, deleteApiKey } from "@/lib/api-keys-service";
import { getRequestDict } from "@/lib/i18n/request";

export type ApiKeyFormState = { error?: string; createdKey?: string };

// Key 管理只走网页登录态，API 本身无法管理 Key（防泄露后自我提权）
export async function createApiKeyAction(
  _prev: ApiKeyFormState,
  formData: FormData,
): Promise<ApiKeyFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.sessionExpired };
  const result = await createApiKey(
    user.id,
    String(formData.get("name") ?? ""),
    t,
  );
  if ("error" in result) return { error: result.error };
  refresh();
  return { createdKey: result.secret };
}

export async function deleteApiKeyAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  await deleteApiKey(user.id, id);
  refresh();
}
