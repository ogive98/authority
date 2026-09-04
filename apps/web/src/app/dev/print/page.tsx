"use client";

import { useEffect, useState } from "react";
import {
  AButton,
  ADegradedBanner,
  ADevPage,
  AJobProgress,
  APrintButton,
  ASwitch,
} from "@/components/a";
import { fetchPrintJob } from "@/lib/print-client";
import type { PrintJob } from "@/lib/print-job-mock";

const DOC_ID = "BL-2026-0042";

export default function DevPrintPage() {
  const [job, setJob] = useState<PrintJob | null>(null);
  const [planC, setPlanC] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job?.id) return;
    if (job.status === "done" || job.status === "failed" || job.status === "plan_c") {
      return;
    }
    const t = window.setInterval(() => {
      void fetchPrintJob(job.id).then((next) => {
        if (next) setJob(next);
      });
    }, 400);
    return () => window.clearInterval(t);
  }, [job?.id, job?.status]);

  return (
    <ADevPage
      kicker="UI-12 · Print"
      title="Impression document"
      description="Chemin officiel : PrintButton → job file print. window.print n’est pas l’architecture."
      extraActions={
        <APrintButton
          documentId={DOC_ID}
          planC={planC}
          onJob={(next) => {
            setError(null);
            setJob(next);
          }}
          onError={setError}
        />
      }
      mainClassName="mx-auto max-w-3xl space-y-[var(--a-space-7)] px-[var(--a-space-6)] py-[var(--a-space-7)]"
    >
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Gate : le bouton crée un job mock{" "}
        <span className="a-mono">print.dispatch</span> (file{" "}
        <span className="a-mono">print</span>). Reprint = nouvel{" "}
        <span className="a-mono">Idempotency-Key</span>. Pas de chrome glass sur
        la preview.
      </p>

      <div className="flex items-center gap-3">
        <ASwitch
          size="sm"
          checked={planC}
          onCheckedChange={setPlanC}
          label="Simuler Plan C"
        />
        <span className="text-[length:var(--a-text-sm)]">
          Simuler Plan C (pas d’enqueue agent)
        </span>
      </div>

      {planC || job?.status === "plan_c" ? <ADegradedBanner /> : null}

      <section className="a-card space-y-3 p-[var(--a-space-5)]">
        <h2 className="text-[length:var(--a-text-lg)] font-medium">Preview</h2>
        <div className="rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-1 p-[var(--a-space-5)]">
          <p className="a-mono text-[length:var(--a-text-xs)] uppercase tracking-widest text-a-fg-subtle">
            Bon de livraison
          </p>
          <p className="mt-2 font-medium">{DOC_ID} · Fromagerie ADV · Sfax</p>
          <p className="a-mono a-tabular mt-3 text-[length:var(--a-text-sm)]">
            Brie 250 · 24 colis · 21 459,560 TND
          </p>
        </div>
      </section>

      <section className="a-card space-y-4 p-[var(--a-space-5)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[length:var(--a-text-lg)] font-medium">Job</h2>
          <APrintButton
            documentId={DOC_ID}
            reprintOf={job?.id ?? null}
            disabled={!job}
            planC={planC}
            onJob={(next) => {
              setError(null);
              setJob(next);
            }}
            onError={setError}
          />
        </div>
        {error ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger" role="alert">
            {error}
          </p>
        ) : null}
        <AJobProgress job={job} />
        {job ? (
          <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
            Idempotency-Key {job.idempotencyKey}
          </p>
        ) : null}
      </section>

      <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
        Secours utilisateur uniquement : impression navigateur (hors APrintButton).{" "}
        <AButton
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => window.print()}
        >
          window.print (secours)
        </AButton>
      </p>
    </ADevPage>
  );
}
