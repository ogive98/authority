import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-a-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-a-surface-1",
  {
    variants: {
      variant: {
        primary:
          "bg-a-accent text-a-accent-fg hover:bg-a-accent-hover border border-transparent",
        secondary:
          "bg-a-surface-3 text-a-fg border border-a-border-subtle hover:bg-a-surface-4",
        outline:
          "bg-transparent text-a-fg border border-a-border-strong hover:bg-a-surface-3",
        ghost: "bg-transparent text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
        danger:
          "bg-a-danger text-a-danger-fg border border-transparent hover:opacity-90",
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
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          "rounded-[var(--a-radius-md)]",
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
