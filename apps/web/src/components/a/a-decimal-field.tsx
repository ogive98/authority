"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { AInput } from "@/components/a/a-input";

export type ADecimalFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode"
> & {
  /** Unit suffix shown after the field (e.g. TND, kg) — solid surface, never lightning. */
  unit?: string;
  label?: string;
  error?: string;
};

/**
 * Decimal / money / weight field.
 * Tabular nums + mono. Solid surface only (no lightning on TND/stock/DLC).
 */
export const ADecimalField = React.forwardRef<
  HTMLInputElement,
  ADecimalFieldProps
>(({ className, unit, label, error, id, disabled, ...props }, ref) => {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={fieldId}
          className="text-[length:var(--a-text-sm)] font-medium text-a-fg"
        >
          {label}
        </label>
      ) : null}
      <div className="relative flex items-center">
        <AInput
          ref={ref}
          id={fieldId}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            "a-mono a-tabular pr-14",
            error && "border-a-danger focus-visible:ring-a-danger",
            className,
          )}
          {...props}
        />
        {unit ? (
          <span
            className="pointer-events-none absolute right-3 a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle"
            aria-hidden
          >
            {unit}
          </span>
        ) : null}
      </div>
      {error ? (
        <p
          id={errorId}
          className="text-[length:var(--a-text-xs)] text-a-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
});
ADecimalField.displayName = "ADecimalField";
