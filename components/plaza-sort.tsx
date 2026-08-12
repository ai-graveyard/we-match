"use client";

import { ChevronDown } from "lucide-react";
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
    <label
      className={`relative inline-flex h-10 shrink-0 items-center text-gray transition-opacity duration-100 hover:text-ink ${
        pending ? "opacity-60" : ""
      }`}
    >
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        disabled={pending}
        onChange={(event) => {
          const option = options.find((item) => item.value === event.target.value);
          if (!option || option.value === value) return;
          startTransition(() => router.replace(option.href, { scroll: false }));
        }}
        className="h-10 appearance-none bg-transparent pl-0 pr-4 font-mono text-2xs text-current outline-none disabled:cursor-wait"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        aria-hidden
        className="pointer-events-none absolute right-0"
      />
    </label>
  );
}
