"use server";

import { redirect } from "next/navigation";
import {
  destroySession,
  requestVerificationCode,
  verifyCodeAndLogin,
} from "@/lib/auth";

export type AuthFormState = { error?: string; sentAt?: number };

// 登录后回跳只允许站内路径，防开放重定向
function safeNext(next: unknown): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/";
}

export async function requestCodeAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const { error } = await requestVerificationCode(phone);
  if (error) return { error };
  return { sentAt: Date.now() };
}

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const { error, isNew } = await verifyCodeAndLogin(phone, code);
  if (error) return { error };
  const next = safeNext(formData.get("next"));
  // 从具体任务触发的首次登录优先回到原页面；首页登录才进入可跳过的新用户引导。
  redirect(isNew && next === "/" ? "/me/card?welcome=1" : next);
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
