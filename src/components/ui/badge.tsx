import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
        secondary: "border-transparent bg-[var(--surface-2)] text-[var(--muted)]",
        success: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
        warning: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
        destructive: "border-transparent bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
        outline: "border-[var(--border)] text-[var(--foreground)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { Badge, badgeVariants };
