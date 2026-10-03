"use client";

import { FormSelect } from "@/components/ui/form-select";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function CardPreviewSelect({
  label,
  value,
  options,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; href: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <FormSelect
      label={label} value={value} disabled={pending} className="w-full"
      options={options}
      onValueChange={(value) => {
        const option = options.find((item) => item.value === value);
        if (option) startTransition(() => router.replace(option.href, { scroll: false }));
      }}
    />
  );
}
