"use client";

import { ASwitch } from "@/components/a";
import { cn } from "@/lib/utils";

type PrefsToggleRowProps = {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Prefs row — visible title + hint + compact switch.
 * No border chrome; spacing so toggles never collide unlabeled.
 */
export function PrefsToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: PrefsToggleRowProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 py-2.5",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
          {title}
        </p>
        {description ? (
          <p className="text-[length:var(--a-text-xs)] leading-snug text-a-fg-muted">
            {description}
          </p>
        ) : null}
      </div>
      <ASwitch
        size="sm"
        label={title}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5"
      />
    </div>
  );
}
