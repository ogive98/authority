"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import {
  AButton,
  AErrorState,
  AForbiddenState,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import { BulletinPrintSheet } from "@/components/hr/bulletin-print-sheet";
import {
  downloadBulletinPdf,
  fetchBulletin,
  type Bulletin,
} from "@/lib/hr";
import { softPageBody } from "@/lib/soft-glass-ui";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: Bulletin }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function HrBulletinPrintPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const res = await fetchBulletin(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({ kind: "ok", data: res.data });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPdf() {
    if (!id) return;
    setPdfBusy(true);
    setPdfError(null);
    const res = await downloadBulletinPdf(id);
    setPdfBusy(false);
    if (!res.ok) setPdfError(res.message);
  }

  return (
    <>
      <div className="print:hidden">
        <AScreenHeader
          kicker="Ressources humaines"
          title="Bulletin"
          description="Impression Soft Glass + PDF serveur (layout légal minimal)."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href="/hr"
                className="inline-flex items-center rounded-[var(--a-radius-md)] bg-a-surface-3 px-3 py-1.5 text-[length:var(--a-text-sm)] font-medium text-a-fg hover:opacity-90"
              >
                Retour RH
              </Link>
              {state.kind === "ok" ? (
                <>
                  <AButton type="button" onClick={() => window.print()}>
                    <Printer className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
                    Imprimer
                  </AButton>
                  <AButton
                    type="button"
                    variant="secondary"
                    disabled={pdfBusy}
                    onClick={() => void onPdf()}
                  >
                    <FileDown className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
                    PDF
                  </AButton>
                </>
              ) : null}
            </div>
          }
        />
        {pdfError ? (
          <p className="mb-3 text-[length:var(--a-text-sm)] text-a-danger-fg">
            {pdfError}
          </p>
        ) : null}
      </div>

      <div
        className={`${softPageBody} mx-auto max-w-2xl print:max-w-none print:p-0`}
      >
        {state.kind === "loading" ? (
          <ASkeleton className="h-64 w-full print:hidden" />
        ) : null}
        {state.kind === "forbidden" ? (
          <div className="print:hidden">
            <AForbiddenState message={state.message} />
          </div>
        ) : null}
        {state.kind === "error" ? (
          <div className="print:hidden">
            <AErrorState
              message={state.message}
              retryable
              onRetry={() => void load()}
            />
          </div>
        ) : null}
        {state.kind === "ok" ? (
          <BulletinPrintSheet
            data={{
              number: state.data.number,
              periodYm: state.data.periodYm,
              employeeName: state.data.employeeName ?? "—",
              matricule: state.data.matricule ?? "—",
              contractNumber: state.data.contractNumber ?? "—",
              wageBase: state.data.wageBase,
              cnssEmployeeAmount: state.data.cnssEmployeeAmount,
              cnssEmployerAmount: state.data.cnssEmployerAmount,
              irppMonthly: state.data.irppMonthly,
              netPay: state.data.netPay,
              currency: state.data.currency,
              annualTaxableBeforeAbat: state.data.annualTaxableBeforeAbat,
              abatChefAnnual: state.data.abatChefAnnual,
              abatEnfantAnnual: state.data.abatEnfantAnnual,
              abatTotalAnnual: state.data.abatTotalAnnual,
              taxChefDeFamille: state.data.taxChefDeFamille,
              taxEnfantCount: state.data.taxEnfantCount,
            }}
          />
        ) : null}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .hr-bulletin-sheet, .hr-bulletin-sheet * { visibility: visible !important; }
          .hr-bulletin-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
