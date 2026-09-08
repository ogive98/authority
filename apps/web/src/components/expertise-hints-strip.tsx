"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ABadge } from "@/components/a";
import {
  fetchExpertiseCatalog,
  type ExpertiseSlot,
} from "@/lib/settings";

type Props = {
  /** Slot keys to show, e.g. tax.fodec, hr.cnss */
  keys: string[];
  className?: string;
};

/**
 * Readiness strip for FODEC/CNSS/… — never invents rates.
 * PENDING → link to Préférences; VALIDATED → show expert value.
 */
export function ExpertiseHintsStrip({ keys, className }: Props) {
  const [slots, setSlots] = useState<ExpertiseSlot[] | null>(null);
  const keyKey = [...keys].sort().join("|");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchExpertiseCatalog();
      if (cancelled) return;
      if (!res.ok) {
        setSlots([]);
        return;
      }
      const wanted = new Set(keyKey.split("|").filter(Boolean));
      setSlots(res.data.items.filter((i) => wanted.has(i.key)));
    })();
    return () => {
      cancelled = true;
    };
  }, [keyKey]);

  if (!slots || slots.length === 0) return null;

  return (
    <div
      className={
        className ??
        "flex flex-wrap items-center gap-2 rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-xs)]"
      }
    >
      <span className="text-a-fg-muted">Expertise</span>
      {slots.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="font-medium text-a-fg">{s.label}</span>
          {s.status === "VALIDATED" && s.valueSummary ? (
            <>
              <ABadge tone="success">{s.valueSummary}</ABadge>
              {s.lawRef ? (
                <span className="text-a-fg-muted">{s.lawRef}</span>
              ) : null}
            </>
          ) : (
            <ABadge tone="warning">En attente expert</ABadge>
          )}
        </span>
      ))}
      <Link
        href="/settings#expertise"
        className="ml-auto text-a-accent hover:underline"
      >
        Préférences
      </Link>
    </div>
  );
}
