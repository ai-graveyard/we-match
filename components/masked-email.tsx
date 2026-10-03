"use client";

import { Button } from "@/components/ui/button";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";

  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visibleLength = Math.min(local.length > 3 ? 2 : 1, local.length);
  return `${local.slice(0, visibleLength)}***${domain}`;
}

export function MaskedEmail({
  email,
  showLabel,
  hideLabel,
}: {
  email: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="-mt-2 flex min-w-0 items-center gap-1">
      <span className="truncate font-mono text-xs text-gray">
        {revealed ? email : maskEmail(email)}
      </span>
      <Button variant="plain" size="plain"
        type="button"
        className="flex size-11 shrink-0 items-center justify-center rounded-sm text-gray transition-colors duration-100 hover:bg-bg-3 hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-ink"
        aria-label={revealed ? hideLabel : showLabel}
        aria-pressed={revealed}
        title={revealed ? hideLabel : showLabel}
        onClick={() => setRevealed((current) => !current)}
      >
        {revealed ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
      </Button>
    </div>
  );
}
