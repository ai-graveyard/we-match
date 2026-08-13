"use server";

import { refresh } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import {
  blockUser,
  moderateContent,
  resolveReport,
  submitReport,
  unblockUser,
} from "@/lib/safety-service";
import { getRequestDict } from "@/lib/i18n/request";

export type ReportFormState = { error?: string; ok?: string };

export async function reportContentAction(
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.loginRequired };
  return submitReport(
    user,
    {
      targetType: String(formData.get("targetType")),
      targetId: Number(formData.get("targetId")),
      reason: String(formData.get("reason")),
      details: String(formData.get("details") ?? "").trim(),
    },
    t,
  );
}

export async function blockUserAction(formData: FormData) {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return;
  const result = await blockUser(user, Number(formData.get("targetId")), t);
  if (result && "ok" in result) refresh();
}

export async function unblockUserAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const result = await unblockUser(user, Number(formData.get("targetId")));
  if (result) refresh();
}

export async function moderateContentAction(formData: FormData) {
  const admin = await getSessionUser();
  if (!admin || !isAdmin(admin)) return;
  const result = await moderateContent(admin, {
    targetType: String(formData.get("targetType")),
    targetId: Number(formData.get("targetId")),
    action: String(formData.get("moderationAction")),
  });
  if (result) refresh();
}

export async function handleReportAction(formData: FormData) {
  const admin = await getSessionUser();
  if (!admin || !isAdmin(admin)) return;
  const result = await resolveReport(admin, {
    reportId: Number(formData.get("reportId")),
    decision: String(formData.get("decision")),
  });
  if (result) refresh();
}
