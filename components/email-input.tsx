"use client";

import { useDict } from "@/lib/i18n/client";

export const EMAIL_MAX_LENGTH = 254;

// 客户端只做「像不像邮箱」的按钮可用性判断，真校验在服务端 lib/auth.ts
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@,;]+@[^\s@.,;]+\.[^\s@.,;]+/.test(value);
}

// 登录邮箱输入框。和 PhoneInput 同高同边框，换掉后登录页排版不变。
export function EmailInput({
  value,
  onChange,
  name,
  id,
  required = false,
  autoComplete = "email",
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  name: string;
  id?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  const t = useDict();
  return (
    <div className="flex h-11 w-full items-center overflow-hidden rounded-sm border border-line bg-panel transition-colors duration-100 focus-within:border-ink">
      <input
        id={id}
        className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-sm outline-none placeholder:font-sans placeholder:text-gray"
        type="email"
        name={name}
        inputMode="email"
        maxLength={EMAIL_MAX_LENGTH}
        placeholder={placeholder ?? t.login.emailPlaceholder}
        required={required}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        // 大小写不敏感，直接在输入时归一，省得用户以为自己开了两个号
        onChange={(e) => onChange(e.target.value.trimStart().toLowerCase())}
      />
    </div>
  );
}
