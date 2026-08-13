"use server";

import { refresh } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import {
  cancelConnection,
  confirmConnectionCompleted,
  expressInterest,
  handleConnection,
} from "@/lib/connections-service";
import { getRequestDict } from "@/lib/i18n/request";

export type ConnectionFormState = { error?: string; ok?: string };

export async function expressInterestAction(
  _prev: ConnectionFormState,
  formData: FormData,
): Promise<ConnectionFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.loginRequired };
  const result = await expressInterest(
    user,
    {
      needId: Number(formData.get("needId")),
      message: String(formData.get("message") ?? "").trim(),
      contact: String(formData.get("contact") ?? ""),
    },
    t,
  );
  if ("error" in result) return { error: result.error };
  refresh();
  return { ok: t.connection.submitted };
}

export async function handleConnectionAction(
  _prev: ConnectionFormState,
  formData: FormData,
): Promise<ConnectionFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.loginRequired };
  const decision = String(formData.get("decision"));
  if (decision !== "accept" && decision !== "reject") {
    return { error: t.common.badParams };
  }
  const result = await handleConnection(
    user,
    {
      connectionId: Number(formData.get("connectionId")),
      decision,
    },
    t,
  );
  if (!result) return {};
  if ("error" in result) return { error: result.error };
  refresh();
  return {};
}

export async function cancelConnectionAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const result = await cancelConnection(user, Number(formData.get("connectionId")));
  if (result) refresh();
}

export async function confirmConnectionCompletedAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const result = await confirmConnectionCompleted(
    user,
    Number(formData.get("connectionId")),
  );
  if (result) refresh();
}
