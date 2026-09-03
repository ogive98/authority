import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center border px-2 py-0.5 text-[length:var(--a-text-xs)] font-medium rounded-[var(--a-radius-sm)]",
  {
    variants: {
      tone: {
        neutral: "border-a-border-subtle bg-a-surface-3 text-a-fg-muted",
        accent: "border-transparent bg-a-accent-muted text-a-accent",
        success: "border-transparent bg-a-success text-a-success-fg",
        warning: "border-transparent bg-a-warning text-a-warning-fg",
        danger: "border-transparent bg-a-danger text-a-danger-fg",
        info: "border-transparent bg-a-info text-a-info-fg",
        spectre: "border-a-spectre bg-a-spectre-muted text-a-spectre-fg",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props} />
  );
}

export { badgeVariants };
