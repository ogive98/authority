"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AWorkflowStep = {
  id: string;
  label: string;
  done?: boolean;
  current?: boolean;
};

export type AWorkflowStepperProps = {
  steps: AWorkflowStep[];
  className?: string;
};

export function AWorkflowStepper({ steps, className }: AWorkflowStepperProps) {
  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-2 text-[length:var(--a-text-sm)]",
        className,
      )}
    >
      {steps.map((step, i) => (
        <li key={step.id} className="flex items-center gap-2">
          {i > 0 ? (
            <span className="text-a-fg-subtle" aria-hidden>
              /
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-md px-2 py-1",
              step.current && "bg-a-accent/15 font-medium text-a-accent",
              step.done && !step.current && "text-a-fg-muted",
              !step.done && !step.current && "text-a-fg-subtle",
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export type AWorkflowActionBarProps = {
  status?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Workflow validate zone — primary actions right (D225). */
export function AWorkflowActionBar({
  status,
  children,
  className,
}: AWorkflowActionBarProps) {
  return (
    <div
      className={cn(
        "a-underlay flex flex-wrap items-center justify-between gap-3 rounded-md px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0 text-[length:var(--a-text-sm)] text-a-fg-muted">
        {status}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
      </div>
    </div>
  );
}
