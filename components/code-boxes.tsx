"use client";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const SANITIZERS = {
  numeric: (raw: string) => raw.replace(/\D/g, ""),
  alphanumeric: (raw: string) => raw.replace(/[^0-9a-z]/gi, "").toUpperCase(),
} as const;
export type CodeFormat = keyof typeof SANITIZERS;
export function sanitizeCode(format: CodeFormat, raw: string, length: number): string {
  return SANITIZERS[format](raw).slice(0, length);
}

export function CodeBoxes({ length, format, value, onChange, name, id, label, autoComplete = "off", required = false }: {
  length: number; format: CodeFormat; value: string; onChange: (value: string) => void;
  name: string; id?: string; label?: string; autoComplete?: string; required?: boolean;
}) {
  return (
    <InputOTP maxLength={length} value={value} onChange={(raw) => onChange(sanitizeCode(format, raw, length))}
      pasteTransformer={(raw) => sanitizeCode(format, raw, length)}
      pattern={format === "numeric" ? "^[0-9]*$" : "^[a-zA-Z0-9]*$"}
      inputMode={format === "numeric" ? "numeric" : "text"}
      name={name} id={id} aria-label={label} autoComplete={autoComplete} required={required}
      containerClassName="w-full" pushPasswordManagerStrategy="none">
      <InputOTPGroup className="w-full gap-2">
        {Array.from({ length }, (_, index) => <InputOTPSlot key={index} index={index} />)}
      </InputOTPGroup>
    </InputOTP>
  );
}
