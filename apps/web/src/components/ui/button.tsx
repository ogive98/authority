import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Soft Glass buttons:
 * - primary = grandes actions (Nouveau / Enregistrer / Créer) — fond accent bleu
 * - secondary / outline / ghost = soulignement accent + hover
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none",
  {
    variants: {
      variant: {
        primary: "a-action-primary focus-visible:ring-2 focus-visible:ring-a-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-a-surface-1",
        secondary: "a-action-quiet px-2",
        outline: "a-action-quiet px-2",
        ghost: "a-action-quiet px-1.5",
        danger:
          "a-action-quiet text-a-danger hover:text-a-danger-fg [&::after]:bg-a-danger",
      },
      size: {
        sm: "h-8 px-3 text-[length:var(--a-text-sm)]",
        md: "h-9 px-4 text-[length:var(--a-text-sm)]",
        lg: "h-10 px-5 text-[length:var(--a-text-md)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isPrimary = !variant || variant === "primary";
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          isPrimary ? "rounded-[var(--a-radius-sm)]" : "rounded-[var(--a-radius-sm)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
