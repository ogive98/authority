import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Pastel pill badges — Utility Cube status chips. */
const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--a-radius-pill)] border border-transparent px-2.5 py-0.5 text-[length:var(--a-text-xs)] font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-a-surface-3 text-a-fg-muted",
        accent: "bg-a-accent-muted text-a-accent",
        success: "bg-a-success-soft text-a-success-fg",
        warning: "bg-a-warning-soft text-a-warning-fg",
        danger: "bg-a-danger-soft text-a-danger-fg",
        info: "bg-a-info-soft text-a-info-fg",
        spectre: "bg-a-spectre-muted text-a-spectre-fg",
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
