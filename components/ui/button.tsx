import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "outline-none focus-visible:ring-1 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "inline-flex items-center justify-center gap-1.5 rounded-sm bg-accent font-semibold tracking-[0.06em] text-white active:translate-y-px",
        outline: "inline-flex items-center justify-center gap-1.5 rounded-sm border border-ink bg-panel font-semibold tracking-[0.06em] text-ink hover:bg-ink hover:text-panel active:translate-y-px",
        secondary: "inline-flex items-center justify-center gap-1.5 rounded-sm border border-line font-semibold text-gray hover:border-ink hover:text-ink active:translate-y-px",
        destructive: "inline-flex items-center justify-center gap-1.5 rounded-sm bg-ink font-semibold text-panel active:translate-y-px",
        ghost: "inline-flex items-center justify-center gap-1.5 rounded-sm text-gray hover:bg-bg-3 hover:text-ink",
        link: "inline-flex items-center gap-1 text-2xs text-gray hover:text-ink underline-offset-4 hover:underline",
        plain: "",
      },
      size: {
        default: "min-h-11 px-4 py-2 text-center text-sm",
        sm: "h-10 px-3 text-xs",
        xs: "h-8 px-2 text-xs",
        lg: "min-h-12 px-6 py-2 text-sm",
        icon: "size-11 shrink-0 p-0",
        "icon-sm": "size-10 shrink-0 p-0",
        "icon-xs": "size-8 shrink-0 p-0",
        "icon-lg": "size-12 shrink-0 p-0",
        plain: "",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({ className, variant, size, asChild = false, ...props }:
  React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
export { Button, buttonVariants };
