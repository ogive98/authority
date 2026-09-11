"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ASwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name */
  label: string;
  className?: string;
  size?: "sm" | "md";
};

/**
 * iOS-like minimal toggle — used for theme, SPECTRE, PATCH, etc.
 * Soft Glass: no border chrome; default size sm for Prefs density.
 */
export function ASwitch({
  checked,
  onCheckedChange,
  disabled,
  label,
  className,
  size = "sm",
}: ASwitchProps) {
  const track = size === "sm" ? "h-4 w-7" : "h-5 w-9";
  const thumb =
    size === "sm" ? "h-3 w-3 translate-x-0.5" : "h-4 w-4 translate-x-0.5";
  const thumbOn =
    size === "sm" ? "translate-x-[0.875rem]" : "translate-x-[1.125rem]";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-[background-color] duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-a-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-a-surface-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "motion-reduce:transition-none",
        track,
        checked ? "bg-a-accent" : "bg-a-surface-4",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none block rounded-full shadow-sm transition-transform duration-200 ease-out",
          "motion-reduce:transition-none",
          thumb,
          checked ? thumbOn : null,
          checked ? "bg-a-accent-fg" : "bg-a-fg",
        )}
        aria-hidden
      />
    </button>
  );
}
