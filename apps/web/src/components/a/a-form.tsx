"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AFieldProps = {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
  required?: boolean;
};

/**
 * D294 form field — label above (13px/500 muted) + control + hint/error.
 */
export function AField({
  label,
  children,
  hint,
  htmlFor,
  className,
  required,
}: AFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <label
        htmlFor={htmlFor}
        className="a-field-label"
      >
        {label}
        {required ? (
          <span className="text-a-accent" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export type AFormSectionProps = {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * D294 form section — one business question per block.
 */
export function AFormSection({
  title,
  description,
  children,
  className,
}: AFormSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {title || description ? (
        <div className="min-w-0">
          {title ? (
            <h3 className="text-[length:var(--a-text-md)] font-medium tracking-[-0.01em] text-a-fg">
              {title}
            </h3>
          ) : null}
          {description ? (
            <p className="mt-0.5 text-[length:var(--a-text-xs)] text-a-fg-muted">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-3">{children}</div>
    </section>
  );
}
