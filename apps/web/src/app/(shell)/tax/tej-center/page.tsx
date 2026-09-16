"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import {
  createTaxWithholding,
  detectRas,
  downloadRasCertificate,
  fetchTaxWithholdings,
  fetchTejCenterOverview,
  generateRasCertificate,
  validateTaxWithholding,
  WH_STATUS_LABELS,
  type RasDetectResult,
  type TaxWithholding,
  type TejCenterOverview,
} from "@/lib/tax";
import { softPanel, softTableWrap, softThead, softTr } from "@/lib/soft-glass-ui";

type Load =
  | { kind: "loading" }
  | {
      kind: "ok";
      overview: TejCenterOverview;
      items: TaxWithholding[];
    }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function statusTone(
  status: TaxWithholding["status"],
): "success" | "warning" | "neutral" | "danger" | "accent" {
  if (status === "CERTIFICATE_READY") return "accent";
  if (status === "VALIDATED" || status === "ACCEPTED") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "CALCULATED" || status === "DETECTED") return "warning";
  return "neutral";
}

export default function TejCenterPage() {
  const router = useRouter();
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [periodLabel, setPeriodLabel] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [detectPreview, setDetectPreview] = useState<RasDetectResult | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    setActionError(null);
    const period = periodLabel.trim() || undefined;
    const [ov, list] = await Promise.all([
      fetchTejCenterOverview(period),
      fetchTaxWithholdings({ periodLabel: period }),
    ]);
    if (!ov.ok) {
      if (ov.status === 403) {
        setState({ kind: "forbidden", message: ov.message });
        return;
      }
      setState({ kind: "error", message: ov.message });
      return;
    }
    if (!list.ok) {
      if (list.status === 403) {
        setState({ kind: "forbidden", message: list.message });
        return;
      }
      setState({ kind: "error", message: list.message });
      return;
    }
    setState({
      kind: "ok",
      overview: ov.data,
      items: list.data.items,
    });
  }, [periodLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDetect() {
    setBusy(true);
    setFormError(null);
    setDetectPreview(null);
    const base = Number(baseAmount.replace(",", "."));
    const res = await detectRas({
      baseAmount: base,
      vendorName: vendorName.trim(),
      periodLabel: periodLabel.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDetectPreview(res.data);
  }

  async function onCreate() {
    setBusy(true);
    setFormError(null);
    const base = Number(baseAmount.replace(",", "."));
    const res = await createTaxWithholding({
      baseAmount: base,
      vendorName: vendorName.trim(),
      periodLabel: periodLabel.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    setVendorName("");
    setBaseAmount("");
    setDetectPreview(null);
    await load();
  }

  async function onValidate(id: string) {
    setActionError(null);
    const res = await validateTaxWithholding(id);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await load();
  }

  async function onCertificate(id: string) {
    setActionError(null);
    const res = await generateRasCertificate(id);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    downloadRasCertificate(res.data);
    await load();
  }

  const overview = state.kind === "ok" ? state.overview : null;
  const items = state.kind === "ok" ? state.items : [];

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/tax" className="hover:text-a-fg">
            Fiscalité
          </Link>
        }
        kicker="Fiscalité"
        title="TEJ Center"
        description="Hub Soft Glass RAS → TEJ — validation · certificat local (D284) · transmission DISABLED."
        primary={
          <AButton
            type="button"
            size="sm"
            onClick={() => {
              setFormError(null);
              setDetectPreview(null);
              setDrawerOpen(true);
            }}
          >
            Nouvelle retenue
          </AButton>
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "tax",
                label: "Catalogue TVA",
                onSelect: () => router.push("/tax"),
              },
              {
                id: "prefs",
                label: "Préférences Expertise",
                onSelect: () => router.push("/settings#expertise"),
              },
              {
                id: "ap",
                label: "Factures fournisseurs",
                onSelect: () => router.push("/finance/ap-bills"),
              },
              {
                id: "help",
                label: "Aide",
                onSelect: () => router.push("/help"),
              },
            ]}
          />
        }
      />
      <APageBody>
        <ExpertiseHintsStrip keys={["tax.ras", "tax.tej"]} />

        <div className="mb-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Période
            </span>
            <AInput
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="2026-09"
              className="w-36"
            />
          </label>
          <AButton type="button" size="sm" onClick={() => void load()}>
            Actualiser
          </AButton>
          <ABadge tone="warning">Transmission DISABLED</ABadge>
        </div>

        {state.kind === "loading" ? (
          <ASkeleton className="h-32 w-full" />
        ) : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load()}
          />
        ) : null}

        {overview ? (
          <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <APageSection title="Retenues">
              <div className={`${softPanel} space-y-2 p-4`}>
                <p className="a-mono text-[length:var(--a-text-2xl)] tabular-nums">
                  {overview.withholdings.total}
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-muted">
                  Période {overview.periodLabel}
                </p>
              </div>
            </APageSection>
            <APageSection title="À valider">
              <div className={`${softPanel} space-y-2 p-4`}>
                <p className="a-mono text-[length:var(--a-text-2xl)] tabular-nums">
                  {overview.withholdings.needingValidation}
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-muted">
                  DETECTED / CALCULATED
                </p>
              </div>
            </APageSection>
            <APageSection title="Validées">
              <div className={`${softPanel} space-y-2 p-4`}>
                <p className="a-mono text-[length:var(--a-text-2xl)] tabular-nums">
                  {overview.withholdings.validated}
                </p>
                <p className="a-mono text-[length:var(--a-text-sm)] tabular-nums text-a-muted">
                  {overview.withholdings.amountWithheldValidated} TND
                </p>
              </div>
            </APageSection>
            <APageSection title="Brouillons TEJ">
              <div className={`${softPanel} space-y-2 p-4`}>
                <p className="a-mono text-[length:var(--a-text-2xl)] tabular-nums">
                  {overview.tejExports.localDrafts}
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-muted">
                  Stub bloqués : {overview.withholdings.stubBlocked}
                </p>
                <Link
                  href="/tax"
                  className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
                >
                  Générer XML local →
                </Link>
              </div>
            </APageSection>
          </div>
        ) : null}

        {actionError ? (
          <p className="mb-3 text-[length:var(--a-text-sm)] text-a-danger">
            {actionError}
          </p>
        ) : null}

        {state.kind === "ok" && items.length === 0 ? (
          <AEmptyState
            title="Aucune retenue"
            description="Détectez une RAS depuis Prefs tax.ras VALIDATED — jamais de taux inventé."
            actionLabel="Nouvelle retenue"
            onAction={() => setDrawerOpen(true)}
          />
        ) : null}

        {state.kind === "ok" && items.length > 0 ? (
          <div className={softTableWrap}>
            <table className="w-full text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="px-3 py-2 font-medium">Fournisseur</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 font-medium text-right">Base</th>
                  <th className="px-3 py-2 font-medium text-right">RAS</th>
                  <th className="px-3 py-2 font-medium text-right">Net</th>
                  <th className="px-3 py-2 font-medium">Décision</th>
                  <th className="px-3 py-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className={softTr}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.vendorName}</div>
                      <div className="text-[length:var(--a-text-xs)] text-a-muted">
                        {row.periodLabel ?? "—"}
                        {row.isStubRate ? " · stub" : ""}
                        {row.apPaymentId ? " · AP" : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <ABadge tone={statusTone(row.status)}>
                        {WH_STATUS_LABELS[row.status]}
                      </ABadge>
                    </td>
                    <td className="px-3 py-2 text-right a-mono tabular-nums">
                      {row.baseAmount}
                    </td>
                    <td className="px-3 py-2 text-right a-mono tabular-nums">
                      {row.withholdingAmount}
                    </td>
                    <td className="px-3 py-2 text-right a-mono tabular-nums">
                      {row.netPayable ?? "—"}
                    </td>
                    <td className="px-3 py-2 max-w-[16rem] text-[length:var(--a-text-xs)] text-a-muted">
                      {row.decisionCode}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {(row.status === "CALCULATED" ||
                          row.status === "DETECTED") &&
                        row.applicable === true &&
                        !row.isStubRate ? (
                          <AButton
                            type="button"
                            size="sm"
                            onClick={() => void onValidate(row.id)}
                          >
                            Valider
                          </AButton>
                        ) : null}
                        {row.status === "VALIDATED" ? (
                          <AButton
                            type="button"
                            size="sm"
                            onClick={() => void onCertificate(row.id)}
                          >
                            Certificat
                          </AButton>
                        ) : null}
                        {row.status === "CERTIFICATE_READY" ? (
                          <AButton
                            type="button"
                            size="sm"
                            onClick={() => void onCertificate(row.id)}
                          >
                            Télécharger
                          </AButton>
                        ) : null}
                        {row.isStubRate && row.applicable === true ? (
                          <span className="text-[length:var(--a-text-xs)] text-a-warning">
                            Stub — Prefs
                          </span>
                        ) : null}
                        {!row.isStubRate &&
                        row.status !== "CALCULATED" &&
                        row.status !== "DETECTED" &&
                        row.status !== "VALIDATED" &&
                        row.status !== "CERTIFICATE_READY" ? (
                          <span className="text-a-muted">—</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nouvelle retenue RAS"
        description="Calcul depuis Prefs tax.ras VALIDATED uniquement — pas d’invention de taux."
      >
        <div className="space-y-3">
          {formError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-danger">
              {formError}
            </p>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Fournisseur / vendor
            </span>
            <AInput
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Raison sociale"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Base TND
            </span>
            <AInput
              value={baseAmount}
              onChange={(e) => setBaseAmount(e.target.value)}
              placeholder="1000.000"
              className="a-mono"
            />
          </label>
          {detectPreview ? (
            <div className={`${softPanel} space-y-1 p-3 text-[length:var(--a-text-sm)]`}>
              <p>
                <ABadge
                  tone={
                    detectPreview.applicable === true
                      ? detectPreview.isStubRate
                        ? "warning"
                        : "success"
                      : "neutral"
                  }
                >
                  {detectPreview.decisionCode}
                </ABadge>
              </p>
              <p className="text-a-muted">{detectPreview.decisionReason}</p>
              <p className="a-mono tabular-nums">
                RAS {detectPreview.withholdingAmount} · net{" "}
                {detectPreview.netPayable ?? "—"}
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <AButton
              type="button"
              size="sm"
              disabled={
                busy || !vendorName.trim() || !baseAmount.trim()
              }
              onClick={() => void onDetect()}
            >
              Détecter
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={
                busy ||
                !vendorName.trim() ||
                !baseAmount.trim() ||
                detectPreview == null
              }
              onClick={() => void onCreate()}
            >
              Enregistrer
            </AButton>
          </div>
        </div>
      </ADrawer>
    </>
  );
}
