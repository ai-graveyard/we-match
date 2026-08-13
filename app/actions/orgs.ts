"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { normalizeInviteCode } from "@/lib/orgs";
import {
  applyByCode,
  applyPlaza,
  createOrg,
  dissolveOrg,
  handleJoinRequest,
  leaveOrg,
  promoteOrgAdmin,
  removeMember,
  resetInviteCode,
  updateOrg,
} from "@/lib/orgs-service";
import { getRequestDict, getRequestLocale } from "@/lib/i18n/request";
import { localePath } from "@/lib/i18n/routing";
import { fmt } from "@/lib/i18n/fmt";

export type OrgFormState = { error?: string; ok?: string };

export async function createOrgAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const t = await getRequestDict();
  const locale = await getRequestLocale();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.sessionExpired };
  const visRaw = String(formData.get("visibility") ?? "private");
  const result = await createOrg(
    user,
    {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      visibility: visRaw === "public" ? "public" : "private",
    },
    t,
  );
  if ("error" in result) return { error: result.error };
  redirect(localePath(locale, `/orgs/${result.orgId}`));
}

export async function applyByCodeAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.loginRequired };
  const result = await applyByCode(
    user,
    normalizeInviteCode(String(formData.get("code") ?? "")),
    t,
  );
  if ("error" in result) return { error: result.error };
  return { ok: fmt(t.org.appliedTo, { name: result.orgName }) };
}

export async function applyPlazaAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.auth.loginRequired };
  const result = await applyPlaza(user, Number(formData.get("orgId")), t);
  if ("error" in result) return { error: result.error };
  refresh();
  return { ok: t.org.applied };
}

export async function handleRequestAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.org.adminOnly };
  const decision = String(formData.get("decision"));
  if (decision !== "approve" && decision !== "reject") {
    return { error: t.common.badParams };
  }
  const result = await handleJoinRequest(
    user,
    { requestId: Number(formData.get("requestId")), decision },
    t,
  );
  if ("error" in result) return { error: result.error };
  refresh();
  return { ok: result.ok };
}

export async function promoteOrgAdminAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.org.promoteAdminOnly };
  const result = await promoteOrgAdmin(
    user,
    {
      orgId: Number(formData.get("orgId")),
      userId: Number(formData.get("userId")),
    },
    t,
  );
  if ("error" in result) return { error: result.error };
  refresh();
  return { ok: result.ok };
}

export async function updateOrgAction(
  _prev: OrgFormState,
  formData: FormData,
): Promise<OrgFormState> {
  const t = await getRequestDict();
  const user = await getSessionUser();
  if (!user) return { error: t.org.ownerOnly };
  const visRaw = String(formData.get("visibility") ?? "private");
  const result = await updateOrg(
    user,
    {
      orgId: Number(formData.get("orgId")),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
      visibility: visRaw === "public" ? "public" : "private",
    },
    t,
  );
  if ("error" in result) return { error: result.error };
  refresh();
  return { ok: t.common.saved };
}

export async function resetInviteCodeAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const result = await resetInviteCode(user, Number(formData.get("orgId")));
  if (result) refresh();
}

export async function removeMemberAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const result = await removeMember(user, {
    orgId: Number(formData.get("orgId")),
    userId: Number(formData.get("userId")),
  });
  if (result) refresh();
}

export async function leaveOrgAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const result = await leaveOrg(user, Number(formData.get("orgId")));
  if (!result) return;
  redirect(localePath(await getRequestLocale(), "/me?section=organization"));
}

export async function dissolveOrgAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const result = await dissolveOrg(user, Number(formData.get("orgId")));
  if (!result) return;
  redirect(localePath(await getRequestLocale(), "/me?section=organization"));
}
