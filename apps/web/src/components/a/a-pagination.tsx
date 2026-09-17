"use client";

import { AButton } from "@/components/a/a-button";
import { useUiT } from "@/lib/i18n/route-labels";
import { cn } from "@/lib/utils";

export type APaginationProps = {
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  /** Optional status line (e.g. cursor page hint). */
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
};

/**
 * D294 cursor / sequential pagination — quiet secondary actions.
 * Prefer over inventing per-page Prev/Next stacks.
 */
export function APagination({
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  label,
  previousLabel = "Précédent",
  nextLabel = "Suivant",
  className,
}: APaginationProps) {
  const { t } = useUiT();

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="navigation"
      aria-label={t("Pagination")}
    >
      <AButton
        type="button"
        size="sm"
        variant="secondary"
        disabled={previousDisabled}
        onClick={onPrevious}
      >
        {previousLabel}
      </AButton>
      <AButton
        type="button"
        size="sm"
        variant="secondary"
        disabled={nextDisabled}
        onClick={onNext}
      >
        {nextLabel}
      </AButton>
      {label ? (
        <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
          {t(label)}
        </span>
      ) : null}
    </div>
  );
}
