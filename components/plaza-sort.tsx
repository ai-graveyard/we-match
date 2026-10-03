"use client";

import { FormSelect } from "@/components/ui/form-select";


import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { PlazaSort } from "@/lib/plaza-sort";

type SortOption = {
  value: PlazaSort;
  label: string;
  href: string;
};

export function PlazaSortSelect({
  label,
  value,
  options,
}: {
  label: string;
  value: PlazaSort;
  options: SortOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <FormSelect
      label={label} value={value} options={options} disabled={pending}
      className="w-auto border-0 bg-transparent px-0 font-mono text-2xs text-gray focus-visible:ring-offset-2"
      onValueChange={(value) => {
        const option = options.find((item) => item.value === value);
        if (!option) return;
        startTransition(() => router.replace(option.href, { scroll: false }));
      }}
    />
  );
}
