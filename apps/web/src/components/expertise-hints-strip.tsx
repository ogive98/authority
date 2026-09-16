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

function slotIsStub(s: ExpertiseSlot): boolean {
  if (typeof s.isStub === "boolean") return s.isStub;
  return Boolean(
    s.notes?.includes("STUB_UNTIL_EXPERT") ||
      s.lawRef?.includes("STUB_UNTIL_EXPERT"),
  );
}

/**
 * Readiness strip for FODEC/CNSS/… — never invents rates.
 * PENDING → link to Préférences; stub → warning; VALIDATED expert → success.
 */
export function ExpertiseHintsStrip({ keys, className }: Props) {
  const [slots, setSlots] = useState<ExpertiseSlot[] | null>(null);
  const [stubTotal, setStubTotal] = useState(0);
  const keyKey = [...keys].sort().join("|");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchExpertiseCatalog();
      if (cancelled) return;
      if (!res.ok) {
        setSlots([]);
        setStubTotal(0);
        return;
      }
      const wanted = new Set(keyKey.split("|").filter(Boolean));
      setSlots(res.data.items.filter((i) => wanted.has(i.key)));
      setStubTotal(
        res.data.stubUntilExpertCount ??
          res.data.items.filter((i) => slotIsStub(i)).length,
      );
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
        "flex flex-wrap items-center gap-2 rounded-[var(--a-radius-md)] bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-xs)]"
      }
    >
      <span className="text-a-fg-muted">Expertise</span>
      {stubTotal > 0 ? (
        <ABadge tone="warning">{stubTotal} stub(s)</ABadge>
      ) : null}
      {slots.map((s) => {
        const stub = slotIsStub(s);
        return (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="font-medium text-a-fg">{s.label}</span>
            {s.status === "VALIDATED" && s.valueSummary ? (
              <>
                <ABadge tone={stub ? "warning" : "success"}>
                  {stub ? "Stub démo" : s.valueSummary}
                </ABadge>
                {s.lawRef && !stub ? (
                  <span className="text-a-fg-muted">{s.lawRef}</span>
                ) : null}
              </>
            ) : (
              <ABadge tone="warning">En attente expert</ABadge>
            )}
          </span>
        );
      })}
      <Link
        href="/settings#expertise"
        className="ml-auto text-a-accent hover:underline"
      >
        Préférences
      </Link>
    </div>
  );
}
