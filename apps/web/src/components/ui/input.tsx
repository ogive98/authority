import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full bg-a-surface-3/80 px-3 text-[length:var(--a-text-sm)] font-medium text-a-fg shadow-[var(--a-shadow-card)]",
          "placeholder:text-a-fg-subtle",
          "rounded-[var(--a-radius-sm)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-a-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-a-surface-1",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
