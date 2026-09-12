"use client";

import { ABadge } from "@/components/a";
import { softPanel } from "@/lib/soft-glass-ui";

const UPCOMING: Array<{ title: string; body: string }> = [
  {
    title: "Pointage / congés",
    body: "Hors périmètre HR V0 — lots dédiés, pas dans ce dossier.",
  },
  {
    title: "Paie",
    body: "Stub payroll reste DISABLED. TFP / FOPROLOS hors net bulletin.",
  },
];

/** Roadmap only — no fake controls (D211). */
export function HrUpcomingLots() {
  return (
    <section className={softPanel} aria-labelledby="hr-next-title">
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="hr-next-title"
          className="text-[length:var(--a-text-md)] font-semibold text-a-fg"
        >
          Prochains lots
        </h2>
        <ABadge tone="neutral">DISABLED</ABadge>
      </div>
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Prévu, pas branché — pas de bouton fantôme.
      </p>
      <ul className="space-y-3">
        {UPCOMING.map((row) => (
          <li key={row.title}>
            <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
              {row.title}
            </p>
            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              {row.body}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
