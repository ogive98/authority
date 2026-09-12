"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import {
  AButton,
  AErrorState,
  AOverflowMenu,
  APageBody,
  AScreenHeader,
  ASkeleton,
  type AOverflowItem,
} from "@/components/a";
import { BulletinPrintSheet } from "@/components/hr/bulletin-print-sheet";
import {
  downloadPortalBulletinPdf,
  EMPLOYEE_PORTAL_API,
  EMPLOYEE_PORTAL_BULLETINS_PATH,
  type PortalBulletin,
} from "@/lib/employee-portal";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";

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

  const onPdf = useCallback(async () => {
    if (!id) return;
    setPdfBusy(true);
    setPdfError(null);
    const res = await downloadPortalBulletinPdf(id);
    setPdfBusy(false);
    if (!res.ok) setPdfError(res.message);
  }, [id]);

  const bulletin = state.kind === "ok" ? state.data : null;

  const overflowItems = useMemo((): AOverflowItem[] => {
    if (!bulletin) return [];
    return [
      {
        id: "pdf",
        label: (
          <>
            <FileDown className="mr-1.5 inline h-4 w-4" strokeWidth={1.75} />
            PDF
          </>
        ),
        disabled: pdfBusy,
        onSelect: () => void onPdf(),
      },
    ];
  }, [bulletin, pdfBusy, onPdf]);

  return (
    <>
      <div className="print:hidden">
        <AScreenHeader
          breadcrumb={
            <Link
              href={EMPLOYEE_PORTAL_BULLETINS_PATH}
              className="hover:text-a-fg"
            >
              Mes bulletins
            </Link>
          }
          kicker="Portail employé"
          title={bulletin ? bulletin.number : "Bulletin"}
          description="Consultation Soft Glass + reçu PDF (layout légal minimal)."
          primary={
            bulletin ? (
              <AButton type="button" size="sm" onClick={() => window.print()}>
                <Printer className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
                {LAYOUT_ACTIONS.print}
              </AButton>
            ) : undefined
          }
          more={
            overflowItems.length > 0 ? (
              <AOverflowMenu items={overflowItems} />
            ) : undefined
          }
        />
        <APageBody>
          {pdfError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-danger">
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
        </APageBody>
      </div>

      {bulletin ? (
        <APageBody className="mx-auto max-w-3xl">
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
        </APageBody>
      ) : null}
    </>
  );
}
