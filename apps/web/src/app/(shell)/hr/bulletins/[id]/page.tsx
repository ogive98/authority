"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AButton,
  AContextPanel,
  ADetailGrid,
  AErrorState,
  AForbiddenState,
  AOverflowMenu,
  APageBody,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import { BulletinPrintSheet } from "@/components/hr/bulletin-print-sheet";
import { HrTransferOrderPanel } from "@/components/hr/hr-transfer-order-panel";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import {
  downloadBulletinPdf,
  fetchBulletin,
  type Bulletin,
} from "@/lib/hr";

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

  const bulletin = state.kind === "ok" ? state.data : null;

  return (
    <>
      <div className="print:hidden">
        <AScreenHeader
          breadcrumb={
            <Link href="/hr" className="hover:text-a-fg">
              Bulletins
            </Link>
          }
          kicker="Ressources humaines"
          title={bulletin ? bulletin.number : "Bulletin"}
          description="Impression + PDF serveur (layout légal minimal)."
          primary={
            bulletin ? (
              <AButton type="button" size="sm" onClick={() => window.print()}>
                {LAYOUT_ACTIONS.print}
              </AButton>
            ) : undefined
          }
          more={
            bulletin ? (
              <AOverflowMenu
                items={[
                  {
                    id: "pdf",
                    label: "Télécharger PDF",
                    onSelect: () => void onPdf(),
                    disabled: pdfBusy,
                  },
                ]}
              />
            ) : undefined
          }
        />
        {pdfError ? (
          <p className="mb-3 px-6 text-[length:var(--a-text-sm)] text-a-danger-fg md:px-8">
            {pdfError}
          </p>
        ) : null}
        {bulletin ? (
          <APageBody className="mb-6">
            <HrTransferOrderPanel bulletinId={bulletin.id} />
          </APageBody>
        ) : null}
      </div>

      <APageBody className="mx-auto max-w-2xl print:max-w-none print:p-0">
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
        {bulletin ? (
          <ADetailGrid
            primary={
              <BulletinPrintSheet
                data={{
                  number: bulletin.number,
                  periodYm: bulletin.periodYm,
                  employeeName: bulletin.employeeName ?? "—",
                  matricule: bulletin.matricule ?? "—",
                  contractNumber: bulletin.contractNumber ?? "—",
                  wageBase: bulletin.wageBase,
                  cnssEmployeeAmount: bulletin.cnssEmployeeAmount,
                  cnssEmployerAmount: bulletin.cnssEmployerAmount,
                  irppMonthly: bulletin.irppMonthly,
                  netPay: bulletin.netPay,
                  currency: bulletin.currency,
                  annualTaxableBeforeAbat: bulletin.annualTaxableBeforeAbat,
                  abatChefAnnual: bulletin.abatChefAnnual,
                  abatEnfantAnnual: bulletin.abatEnfantAnnual,
                  abatTotalAnnual: bulletin.abatTotalAnnual,
                  taxChefDeFamille: bulletin.taxChefDeFamille,
                  taxEnfantCount: bulletin.taxEnfantCount,
                }}
              />
            }
            context={
              <AContextPanel title="Synthèse" className="print:hidden">
                <dl className="space-y-2 text-[length:var(--a-text-sm)]">
                  <div>
                    <dt className="text-a-fg-muted">Période</dt>
                    <dd className="a-mono tabular-nums">{bulletin.periodYm}</dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Employé</dt>
                    <dd>
                      {bulletin.matricule ? `${bulletin.matricule} · ` : ""}
                      {bulletin.employeeName ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Contrat</dt>
                    <dd className="a-mono">{bulletin.contractNumber ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Base CNSS</dt>
                    <dd className="a-mono tabular-nums">
                      {bulletin.wageBase ?? "—"} {bulletin.currency}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Net à payer</dt>
                    <dd className="a-mono tabular-nums font-medium text-a-fg">
                      {bulletin.netPay} {bulletin.currency}
                    </dd>
                  </div>
                </dl>
              </AContextPanel>
            }
          />
        ) : null}
      </APageBody>

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
