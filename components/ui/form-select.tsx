"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Shared shadcn Select adapter. Radix preserves name/value for native form actions. */
export function FormSelect({ options, label, placeholder, className, id, size, ...props }: {
  options: { value: string; label: string; disabled?: boolean }[];
  label: string;
  placeholder?: string;
  className?: string;
  id?: string;
  size?: "sm" | "default";
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <Select {...props}>
      <SelectTrigger id={id} aria-label={label} size={size} className={className}>
        <SelectValue placeholder={placeholder ?? label} />
      </SelectTrigger>
      <SelectContent position="popper" collisionPadding={16}>
        {options.map((option) => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
