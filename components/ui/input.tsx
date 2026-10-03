import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, variant = "default", ...props }: React.ComponentProps<"input"> & { variant?: "default" | "bare" }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        variant === "default"
          ? "h-11 w-full min-w-0 rounded-sm border border-line bg-panel px-3 text-sm outline-none placeholder:text-gray focus-visible:border-ink disabled:opacity-50"
          : "min-w-0 bg-transparent outline-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
