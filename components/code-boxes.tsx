"use client";

import { useState } from "react";

// 输入过滤：numeric 纯数字；alphanumeric 字母 + 数字（自动转大写）
const SANITIZERS = {
  numeric: (raw: string) => raw.replace(/\D/g, ""),
  alphanumeric: (raw: string) => raw.replace(/[^0-9a-z]/gi, "").toUpperCase(),
} as const;

export type CodeFormat = keyof typeof SANITIZERS;

export function sanitizeCode(
  format: CodeFormat,
  raw: string,
  length: number,
): string {
  return SANITIZERS[format](raw).slice(0, length);
}

// 隐形单输入框盖在 N 个视觉格子上：保留原生键盘、粘贴、自动填充；非法字符输入即被过滤
export function CodeBoxes({
  length,
  format,
  value,
  onChange,
  name,
  id,
  label,
  autoComplete = "off",
  required = false,
}: {
  length: number;
  format: CodeFormat;
  value: string;
  onChange: (value: string) => void;
  name: string;
  id?: string;
  label?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const activeIndex = Math.min(value.length, length - 1);
  return (
    <div className="relative">
      <input
        id={id}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
        type="text"
        name={name}
        inputMode={format === "numeric" ? "numeric" : "text"}
        autoCapitalize={format === "alphanumeric" ? "characters" : undefined}
        autoComplete={autoComplete}
        maxLength={length}
        required={required}
        value={value}
        onChange={(e) => onChange(sanitizeCode(format, e.target.value, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={label}
      />
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
        aria-hidden
      >
        {Array.from({ length }, (_, i) => (
          <div
            key={i}
            className={`flex h-11 items-center justify-center rounded-sm border bg-panel font-mono text-base transition-colors duration-100 ${
              focused && i === activeIndex ? "border-ink" : "border-line"
            }`}
          >
            {value[i] ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}
