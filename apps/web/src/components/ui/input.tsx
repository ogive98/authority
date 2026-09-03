import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full border border-a-border-subtle bg-a-surface-2 px-3 text-[length:var(--a-text-sm)] text-a-fg",
          "placeholder:text-a-fg-subtle",
          "rounded-[var(--a-radius-md)]",
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
