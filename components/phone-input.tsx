"use client";

import { useDict } from "@/lib/i18n/client";

export const PHONE_LENGTH = 11;

// 粘贴/自动填充可能带 +86、空格、连字符：先去非数字，再去国家码前缀
export function normalizePhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > PHONE_LENGTH && digits.startsWith("86")) {
    digits = digits.slice(2);
  }
  return digits.slice(0, PHONE_LENGTH);
}

// 中国大陆手机号输入框：固定 +86 前缀，仅数字，11 位
export function PhoneInput({
  value,
  onChange,
  name,
  id,
  required = false,
  autoComplete = "tel-national",
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
      <span className="flex h-full shrink-0 select-none items-center border-r border-line bg-bg-3 px-2.5 font-mono text-sm text-gray">
        +86
      </span>
      <input
        id={id}
        className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-sm outline-none placeholder:font-sans placeholder:text-gray"
        type="tel"
        name={name}
        inputMode="numeric"
        maxLength={PHONE_LENGTH}
        placeholder={placeholder ?? t.login.phonePlaceholder}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(normalizePhoneInput(e.target.value))}
      />
    </div>
  );
}
