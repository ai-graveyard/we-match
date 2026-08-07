"use client";

import { useActionState, useEffect, useState } from "react";
import {
  loginAction,
  requestCodeAction,
  type AuthFormState,
} from "@/app/actions/auth";
import { CodeBoxes } from "@/components/code-boxes";
import { PhoneInput, PHONE_LENGTH } from "@/components/phone-input";
import { useDict } from "@/lib/i18n/client";

const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;

export function LoginForm({ next }: { next: string }) {
  const t = useDict();
  const [sendState, sendAction, sendPending] = useActionState<
    AuthFormState,
    FormData
  >(requestCodeAction, {});
  const [loginState, loginFormAction, loginPending] = useActionState<
    AuthFormState,
    FormData
  >(loginAction, {});
  // React 19 会在 action 完成后重置非受控表单，手机号/验证码必须受控保留
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  // 倒计时由 sentAt 派生，effect 里只订阅时钟，不同步 setState
  const [now, setNow] = useState(() => Date.now());
  const deadline = sendState.sentAt ? sendState.sentAt + RESEND_SECONDS * 1000 : 0;
  const countdown = Math.min(
    RESEND_SECONDS,
    Math.max(0, Math.ceil((deadline - now) / 1000)),
  );

  useEffect(() => {
    if (!deadline || deadline <= Date.now()) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= deadline) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  const error = loginState.error ?? sendState.error;

  return (
    <form action={loginFormAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <div className="flex gap-2">
        <PhoneInput
          name="phone"
          value={phone}
          onChange={setPhone}
          required
        />
        <button
          type="submit"
          formAction={sendAction}
          formNoValidate
          disabled={
            sendPending || countdown > 0 || phone.length < PHONE_LENGTH
          }
          className="h-11 shrink-0 rounded-sm border border-ink bg-panel px-3 text-sm font-semibold tracking-[0.06em] transition-colors duration-100 hover:bg-ink hover:text-panel active:translate-y-px disabled:border-line disabled:text-gray disabled:hover:bg-panel disabled:hover:text-gray"
        >
          {countdown > 0 ? (
            <span className="font-mono">{countdown}s</span>
          ) : sendPending ? (
            t.login.sending
          ) : (
            t.login.getCode
          )}
        </button>
      </div>
      <CodeBoxes
        length={CODE_LENGTH}
        format="numeric"
        name="code"
        label={t.login.codeLabel}
        autoComplete="one-time-code"
        required
        value={code}
        onChange={setCode}
      />
      {/* 普通面板 + 6px 状态灯，橙只剩这一个点：本屏的焦橙主控件是「登录」按钮，
          警示框式的橙边框和警示图标都是清单外的装饰（见 DESIGN.md 焦橙纪律） */}
      {sendState.notice && (
        <div
          role="alert"
          className="rounded-sm border border-line bg-panel p-3"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <i className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            {sendState.notice.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-gray">
            {sendState.notice.body}
          </p>
        </div>
      )}
      {error && <p className="text-xs text-ink">{error}</p>}
      <button
        type="submit"
        disabled={
          loginPending || phone.length < PHONE_LENGTH || code.length < CODE_LENGTH
        }
        className="h-11 rounded-sm bg-accent text-sm font-semibold tracking-[0.06em] text-panel transition-opacity duration-100 active:translate-y-px disabled:opacity-60"
      >
        {loginPending ? t.login.submitting : t.login.submit}
      </button>
    </form>
  );
}
