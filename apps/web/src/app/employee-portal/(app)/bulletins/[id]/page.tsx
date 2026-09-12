"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import {
  AButton,
  AErrorState,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import { BulletinPrintSheet } from "@/components/hr/bulletin-print-sheet";
import {
  downloadPortalBulletinPdf,
  EMPLOYEE_PORTAL_API,
  EMPLOYEE_PORTAL_BULLETINS_PATH,
  type PortalBulletin,
} from "@/lib/employee-portal";
import { softPageBody } from "@/lib/soft-glass-ui";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: PortalBulletin }
  | { kind: "error"; message: string };

export default function EmployeePortalBulletinDetailPage() {
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
    try {
      const res = await fetch(
        `${EMPLOYEE_PORTAL_API.bulletins}/${encodeURIComponent(id)}`,
        { credentials: "include", headers: { Accept: "application/json" } },
      );
      if (!res.ok) {
        setState({
          kind: "error",
          message:
            res.status === 404
              ? "Bulletin introuvable."
              : "Impossible de charger ce bulletin.",
        });
        return;
      }
      setState({ kind: "ok", data: (await res.json()) as PortalBulletin });
    } catch {
      setState({ kind: "error", message: "Réseau indisponible." });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPdf() {
    if (!id) return;
    setPdfBusy(true);
    setPdfError(null);
    const res = await downloadPortalBulletinPdf(id);
    setPdfBusy(false);
    if (!res.ok) setPdfError(res.message);
  }

  return (
    <>
      <div className={`print:hidden ${softPageBody}`}>
        <AScreenHeader
          kicker="Portail employé"
          title="Bulletin"
          description="Consultation Soft Glass + reçu PDF (layout légal minimal)."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                href={EMPLOYEE_PORTAL_BULLETINS_PATH}
                className="inline-flex items-center rounded-[var(--a-radius-md)] bg-a-surface-3 px-3 py-1.5 text-[length:var(--a-text-sm)] font-medium text-a-fg hover:opacity-90"
              >
                Retour
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
          <p className="mb-4 text-[length:var(--a-text-sm)] text-a-danger">
            {pdfError}
          </p>
        ) : null}
        {state.kind === "loading" ? (
          <div className="space-y-3">
            <ASkeleton className="h-8 w-48" />
            <ASkeleton className="h-64 w-full" />
          </div>
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load()}
          />
        ) : null}
      </div>

      {state.kind === "ok" ? (
        <div className="mx-auto max-w-3xl px-[var(--a-space-5)] pb-[var(--a-space-8)]">
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
        </div>
      ) : null}
    </>
  );
}
