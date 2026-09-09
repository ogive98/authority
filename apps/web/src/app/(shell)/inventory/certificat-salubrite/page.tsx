"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AButton,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  fetchSalubritaCertificate,
  generateDailyCheeseLots,
  type SalubritaCertificateItem,
} from "@/lib/inventory";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; packDate: string; items: SalubritaCertificateItem[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function fmtFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export default function CertificatSalubritePage() {
  const [packDate, setPackDate] = useState(todayIsoLocal);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (date: string) => {
    setState({ kind: "loading" });
    const res = await fetchSalubritaCertificate({ packDate: date });
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({
      kind: "ok",
      packDate: res.data.packDate,
      items: res.data.items,
    });
  }, []);

  useEffect(() => {
    void load(packDate);
  }, [load, packDate]);

  const bodyText = useMemo(() => {
    if (state.kind !== "ok") return "";
    const lines = state.items.map(
      (r) =>
        `${r.productSku}\t${r.productName}\t${fmtFr(r.productionDate)}\t${fmtFr(r.packDate)}\t${fmtFr(r.dlc)}\t${r.daysAfterPack}`,
    );
    return [
      `Certificat de salubrité — FATTORIE COVELLI GROUP — emballage ${fmtFr(state.packDate)}`,
      "",
      "COD Prod.\tDESIGNATION\tDate Production\tDate emballage\tDLC\tJour après emballage",
      ...lines,
      "",
      "Ces produits sont retenus salubres et propres à la consommation humaine au moment de l'examen.",
      "Le Numéro de Lot se réfère à la Date de Production.",
    ].join("\n");
  }, [state]);

  async function onGenerate() {
    setBusy(true);
    setMsg(null);
    const res = await generateDailyCheeseLots({ packDate });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.message);
      return;
    }
    setMsg(
      `Lots ${res.data.packDate} — créés ${res.data.created}, déjà présents ${res.data.skipped}`,
    );
    await load(packDate);
  }

  function onPrint() {
    window.print();
  }

  function onMailto() {
    const subject = encodeURIComponent(
      `Certificat de salubrité — ${fmtFr(packDate)}`,
    );
    const body = encodeURIComponent(bodyText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function onWhatsApp() {
    const text = encodeURIComponent(bodyText.slice(0, 3500));
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <AScreenHeader
        kicker="Stock"
        title="Certificat de salubrité"
        description="Génération lots 00:00 Tunis · DLC = emballage + conservation catalogue. Impression / envoi selon modèle Word."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/products"
              className="text-[13px] font-medium text-a-accent hover:underline"
            >
              Catalogue →
            </Link>
            <Link
              href="/inventory/lots"
              className="text-[13px] font-medium text-a-accent hover:underline"
            >
              Lots →
            </Link>
            <AButton
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void onGenerate()}
            >
              Générer lots du jour
            </AButton>
          </div>
        }
      />

      <div className="mx-auto max-w-5xl space-y-6 px-6 pb-16 pt-2 md:px-10 print:max-w-none print:px-0 print:pb-0">
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <div className="space-y-1">
            <label htmlFor="pack-date" className="text-[12px] text-a-fg-subtle">
              Date emballage
            </label>
            <AInput
              id="pack-date"
              type="date"
              value={packDate}
              onChange={(e) => setPackDate(e.target.value)}
            />
          </div>
          <AButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => void load(packDate)}
          >
            Actualiser
          </AButton>
          <AButton type="button" size="sm" onClick={onPrint}>
            Imprimer
          </AButton>
          <AButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={onMailto}
          >
            Outlook / e-mail
          </AButton>
          <AButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={onWhatsApp}
          >
            WhatsApp
          </AButton>
          <a
            href="/templates/certificato-salubrita.docx"
            download={`certificato-salubrita-${packDate}.docx`}
            className="inline-flex h-8 items-center rounded-[var(--a-radius-md)] bg-a-surface-3 px-3 text-[13px] font-medium text-a-fg hover:bg-a-surface-2"
          >
            Modèle Word
          </a>
        </div>

        {msg ? (
          <p className="text-[13px] text-a-fg-muted print:hidden">{msg}</p>
        ) : null}

        {state.kind === "loading" ? (
          <ASkeleton className="h-64 w-full print:hidden" />
        ) : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load(packDate)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun produit à certifier"
            description="Renseignez « Conservation (jours) » sur les produits actifs du catalogue."
            actionLabel="Ouvrir le catalogue"
            onAction={() => {
              window.location.href = "/products";
            }}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <div
            ref={printRef}
            className="salubrita-sheet bg-white text-black print:shadow-none"
          >
            <CertificateDocument
              packDate={state.packDate}
              items={state.items}
            />
          </div>
        ) : null}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .salubrita-sheet, .salubrita-sheet * { visibility: visible !important; }
          .salubrita-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 12mm 14mm;
          }
        }
      `}</style>
    </>
  );
}

function CertificateDocument({
  packDate,
  items,
}: {
  packDate: string;
  items: SalubritaCertificateItem[];
}) {
  return (
    <article
      className="mx-auto max-w-[210mm] space-y-5 px-2 py-4 font-serif text-[12px] leading-snug text-black"
      lang="fr"
    >
      <header className="grid grid-cols-2 gap-4 border-b border-black/20 pb-3">
        <div className="space-y-0.5 text-[11px]">
          <p className="font-semibold">Dr. Mohamed METHNANI</p>
          <p>Medicine Vétérinaire</p>
          <p>65, Rue Mimosas 2080 Ariana</p>
          <p>Tel: +216-20342809</p>
        </div>
        <div className="space-y-0.5 text-right text-[11px]">
          <p className="font-semibold">Dr. Mohamed METHNANI</p>
          <p>Medicine Vétérinaire</p>
          <p>65, Rue Mimosas 2080 Ariana</p>
          <p>Tel: +216-20342809</p>
          <p className="mt-3">Tunis, le {fmtFr(packDate)}</p>
        </div>
      </header>

      <div className="space-y-1 text-center">
        <h1 className="text-[15px] font-bold uppercase tracking-wide">
          Certificat de salubrité produit de
        </h1>
        <p className="text-[13px] font-semibold">
          FATTORIE COVELLI GROUP-MF 1327082/N
        </p>
        <p className="text-[11px]">
          Km 8, Route de Bizerte Sanheji, Mnihla 2094
        </p>
      </div>

      <p className="text-[12px]">
        Je soussigné Dr. Mohamed Methnani certifie avoir examiné ce jour les
        produits suivants&nbsp;:
      </p>

      <table className="w-full border-collapse text-left text-[10px]">
        <thead>
          <tr className="border-b border-black">
            <th className="py-1.5 pr-2 font-semibold">COD Prod.</th>
            <th className="py-1.5 pr-2 font-semibold">DESIGNATION</th>
            <th className="py-1.5 pr-2 font-semibold">Date Production</th>
            <th className="py-1.5 pr-2 font-semibold">Date emballage</th>
            <th className="py-1.5 pr-2 font-semibold">DLC</th>
            <th className="py-1.5 font-semibold">Jour après emballage</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.productId} className="border-b border-black/15">
              <td className="a-mono py-1 pr-2 align-top">{row.productSku}</td>
              <td className="py-1 pr-2 align-top">{row.productName}</td>
              <td className="a-mono py-1 pr-2 align-top tabular-nums">
                {fmtFr(row.productionDate)}
              </td>
              <td className="a-mono py-1 pr-2 align-top tabular-nums">
                {fmtFr(row.packDate)}
              </td>
              <td className="a-mono py-1 pr-2 align-top tabular-nums">
                {fmtFr(row.dlc)}
              </td>
              <td className="a-mono py-1 align-top tabular-nums">
                {row.daysAfterPack}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="space-y-2 pt-4 text-[11px]">
        <p>
          Ces produits sont retenus salubres et propres à la consommation
          humaine au moment de l&apos;examen.
        </p>
        <p>
          Et suivant les analyses de laboratoire effectuées régulièrement
        </p>
        <p className="font-medium">
          Le Numéro de Lot se réfère à la Date de Production
        </p>
      </footer>
    </article>
  );
}
