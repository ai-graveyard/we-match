import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-16 w-full resize-y rounded-sm border border-line bg-panel px-3 py-2 text-sm outline-none placeholder:text-gray focus-visible:border-ink disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
