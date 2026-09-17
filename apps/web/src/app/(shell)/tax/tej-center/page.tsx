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
  AFilterBar,
  AForbiddenState,
  AInput,
  AListUtilities,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  erpListDescription,
} from "@/components/a";
import { ATabs } from "@/components/a/a-tabs";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import {
  ackTejImport,
  archiveTaxWithholding,
  createTaxWithholding,
  detectRas,
  downloadRasCertificate,
  downloadTejXml,
  fetchTaxWithholdings,
  fetchTejCenterOverview,
  fetchTejExport,
  generateRasCertificate,
  generateTejInvoicePack,
  generateTejPack,
  recordTejResult,
  validateTaxWithholding,
  WH_STATUS_LABELS,
  type RasDetectResult,
  type TaxWithholding,
  type TejCenterOverview,
} from "@/lib/tax";
import { softPanel } from "@/lib/d294-ui";

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
): "success" | "warning" | "neutral" | "danger" | "accent" | "info" {
  if (status === "CERTIFICATE_READY") return "accent";
  if (status === "TEJ_PREPARED") return "info";
  if (status === "TRANSMITTED") return "info";
  if (status === "VALIDATED" || status === "ACCEPTED") return "success";
  if (status === "REJECTED") return "danger";
  if (status === "CALCULATED" || status === "DETECTED") return "warning";
  return "neutral";
}

export default function TejCenterPage() {
  const router = useRouter();
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [periodLabel, setPeriodLabel] = useState("");
  const [sideFilter, setSideFilter] = useState<"ALL" | "AP" | "AR">("ALL");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [detectPreview, setDetectPreview] = useState<RasDetectResult | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    setActionError(null);
    const period = periodLabel.trim() || undefined;
    const [ov, list] = await Promise.all([
      fetchTejCenterOverview(period),
      fetchTaxWithholdings({
        periodLabel: period,
        side: sideFilter === "ALL" ? undefined : sideFilter,
      }),
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
  }, [periodLabel, sideFilter]);

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

  async function onPrepareInvoicePack(arInvoiceId: string) {
    setActionError(null);
    setBusy(true);
    const res = await generateTejInvoicePack(arInvoiceId);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    downloadTejXml(res.data);
    await load();
  }

  async function onPreparePack() {
    setActionError(null);
    const period = periodLabel.trim();
    if (!period) {
      setActionError("Saisissez une période (ex. 2026-09) avant de préparer le lot.");
      return;
    }
    setBusy(true);
    const res = await generateTejPack(
      period,
      sideFilter === "ALL" ? undefined : sideFilter,
    );
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    downloadTejXml(res.data);
    await load();
  }

  async function onRedownloadExport(id: string) {
    setActionError(null);
    setBusy(true);
    const res = await fetchTejExport(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    downloadTejXml(res.data);
  }

  async function onAckImport(id: string) {
    setActionError(null);
    setBusy(true);
    const res = await ackTejImport(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await load();
  }

  async function onAcceptTej(id: string) {
    setActionError(null);
    setBusy(true);
    const res = await recordTejResult(id, { result: "ACCEPTED" });
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await load();
  }

  async function onConfirmReject() {
    if (!rejectId || !rejectReason.trim()) {
      setActionError("Motif de rejet Tej requis.");
      return;
    }
    setActionError(null);
    setBusy(true);
    const res = await recordTejResult(rejectId, {
      result: "REJECTED",
      rejectReason: rejectReason.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setRejectId(null);
    setRejectReason("");
    await load();
  }

  async function onArchive(id: string) {
    setActionError(null);
    setBusy(true);
    const res = await archiveTaxWithholding(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
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
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "RAS → TEJ · AP & AR · certificat · lot XML · accusé import local · Transmission DISABLED",
        )}
        primary={
          <AButton
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void onPreparePack()}
          >
            Préparer lot XML
          </AButton>
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "new",
                label: "Nouvelle retenue",
                onSelect: () => {
                  setFormError(null);
                  setDetectPreview(null);
                  setDrawerOpen(true);
                },
              },
              {
                id: "tax",
                label: "Catalogue TVA",
                onSelect: () => router.push("/tax"),
              },
              {
                id: "invoices",
                label: "Factures clients",
                onSelect: () => router.push("/finance/invoices"),
              },
              {
                id: "ap",
                label: "Factures fournisseurs",
                onSelect: () => router.push("/finance/ap-bills"),
              },
              {
                id: "prefs",
                label: "Préférences Expertise",
                onSelect: () => router.push("/settings#expertise"),
              },
              {
                id: "help",
                label: "Aide",
                onSelect: () => router.push("/help#tax"),
              },
            ]}
          />
        }
      />
      <APageBody>
        <div className={`${softPanel} mb-4 flex flex-wrap items-center gap-4 p-4`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/tej-logo.png"
            alt="تاج Tej — Plateforme de transfert et échange des données fiscales"
            className="h-16 w-auto object-contain"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
              تاج Tej — plateforme d’échange à des fins fiscales
            </p>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              AUTHORITY prépare un XML local pour import manuel dans Tej. Aucune
              transmission API · schéma officiel XSD non revendiqué.
            </p>
          </div>
          <ABadge tone="warning">Transmission DISABLED</ABadge>
          <ABadge tone="neutral">AUTHORITY_LOCAL_DRAFT · v1</ABadge>
        </div>

        <ExpertiseHintsStrip keys={["tax.ras", "tax.tej"]} />

        <AFilterBar
          search={
            <label className="flex flex-col gap-1">
              <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Période
              </span>
              <AInput
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="2026-09"
                className="w-36"
                aria-label="Période"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void load();
                }}
              />
            </label>
          }
          filters={
            <ATabs
              ariaLabel="Filtrer par côté"
              value={sideFilter}
              onValueChange={(id) =>
                setSideFilter(id as "ALL" | "AP" | "AR")
              }
              items={[
                { id: "ALL", label: "Tous" },
                { id: "AP", label: "Fournisseurs" },
                { id: "AR", label: "Clients" },
              ]}
            />
          }
          utilities={<AListUtilities onFilter={() => void load()} />}
        />

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
                <p className="a-mono a-tabular text-[length:var(--a-text-2xl)]">
                  {overview.withholdings.total}
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Période {overview.periodLabel}
                </p>
                {overview.withholdings.bySide ? (
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    AP {overview.withholdings.bySide.AP} · AR{" "}
                    {overview.withholdings.bySide.AR}
                  </p>
                ) : null}
              </div>
            </APageSection>
            <APageSection title="À valider">
              <div className={`${softPanel} space-y-2 p-4`}>
                <p className="a-mono a-tabular text-[length:var(--a-text-2xl)]">
                  {overview.withholdings.needingValidation}
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  DETECTED / CALCULATED
                </p>
              </div>
            </APageSection>
            <APageSection title="Validées">
              <div className={`${softPanel} space-y-2 p-4`}>
                <p className="a-mono a-tabular text-[length:var(--a-text-2xl)]">
                  {overview.withholdings.validated}
                </p>
                <p className="a-mono a-tabular text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Cert. prêts : {overview.withholdings.certificateReady}
                </p>
              </div>
            </APageSection>
            <APageSection title="Lots TEJ">
              <div className={`${softPanel} space-y-2 p-4`}>
                <p className="a-mono a-tabular text-[length:var(--a-text-2xl)]">
                  {overview.withholdings.tejPrepared}
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  À accuser :{" "}
                  {overview.withholdings.awaitingImportAck ??
                    overview.withholdings.tejPrepared}{" "}
                  · Importés {overview.withholdings.transmitted ?? 0}
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Acceptés {overview.withholdings.accepted ?? 0} · Rejetés{" "}
                  {overview.withholdings.rejected ?? 0} · packs{" "}
                  {overview.tejExports.packs}
                </p>
                <p className="a-mono a-tabular text-[length:var(--a-text-sm)] text-a-fg-muted">
                  {overview.withholdings.amountWithheldValidated} TND
                </p>
              </div>
            </APageSection>
          </div>
        ) : null}

        {actionError ? (
          <p className="mb-3 text-[length:var(--a-text-sm)] text-a-danger">
            {actionError}
          </p>
        ) : null}

        {overview?.tejExports.recent && overview.tejExports.recent.length > 0 ? (
          <APageSection title="Lots XML récents" className="mb-4">
            <ASoftTable className="min-w-[40rem]">
              <ASoftThead>
                <ASoftTr>
                  <ASoftTh>Période</ASoftTh>
                  <ASoftTh>Pack</ASoftTh>
                  <ASoftTh numeric>Lignes</ASoftTh>
                  <ASoftTh>SHA</ASoftTh>
                  <ASoftTh numeric>Action</ASoftTh>
                </ASoftTr>
              </ASoftThead>
              <tbody>
                {overview.tejExports.recent.map((ex) => (
                  <ASoftTr key={ex.id}>
                    <ASoftTd className="a-mono">{ex.periodLabel}</ASoftTd>
                    <ASoftTd>
                      <ABadge
                        tone={
                          ex.packKind === "WITHHOLDING_PACK"
                            ? "info"
                            : "neutral"
                        }
                      >
                        {ex.packKind === "WITHHOLDING_PACK"
                          ? "Lot retenues"
                          : "Meta"}
                      </ABadge>
                    </ASoftTd>
                    <ASoftTd numeric>{ex.withholdingCount}</ASoftTd>
                    <ASoftTd className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                      {ex.contentSha256.slice(0, 12)}…
                    </ASoftTd>
                    <ASoftTd numeric>
                      <AButton
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void onRedownloadExport(ex.id)}
                      >
                        Télécharger
                      </AButton>
                    </ASoftTd>
                  </ASoftTr>
                ))}
              </tbody>
            </ASoftTable>
          </APageSection>
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
          <ASoftTable className="min-w-[64rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>Tiers</ASoftTh>
                <ASoftTh>Côté</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
                <ASoftTh numeric>Base</ASoftTh>
                <ASoftTh numeric>RAS</ASoftTh>
                <ASoftTh numeric>Net</ASoftTh>
                <ASoftTh>Décision</ASoftTh>
                <ASoftTh numeric>Action</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {items.map((row) => (
                <ASoftTr key={row.id}>
                  <ASoftTd>
                    <div className="font-medium">{row.vendorName}</div>
                    <div className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                      {row.periodLabel ?? "—"}
                      {row.certificateNumber
                        ? ` · ${row.certificateNumber}`
                        : ""}
                      {row.isStubRate ? " · stub" : ""}
                      {row.apPaymentId ? " · AP pay" : ""}
                      {row.arInvoiceId ? (
                        <>
                          {" · "}
                          <Link
                            href={`/finance/invoices/${row.arInvoiceId}`}
                            className="text-a-accent hover:underline"
                          >
                            Facture
                          </Link>
                        </>
                      ) : null}
                    </div>
                  </ASoftTd>
                  <ASoftTd>
                    <ABadge tone={row.side === "AR" ? "info" : "neutral"}>
                      {row.side === "AR" ? "Client" : "Fournisseur"}
                    </ABadge>
                  </ASoftTd>
                  <ASoftTd>
                    <ABadge tone={statusTone(row.status)}>
                      {WH_STATUS_LABELS[row.status]}
                    </ABadge>
                  </ASoftTd>
                  <ASoftTd numeric>{row.baseAmount}</ASoftTd>
                  <ASoftTd numeric>{row.withholdingAmount}</ASoftTd>
                  <ASoftTd numeric>{row.netPayable ?? "—"}</ASoftTd>
                  <ASoftTd className="max-w-[16rem] text-[length:var(--a-text-xs)] text-a-fg-muted">
                    {row.decisionCode}
                  </ASoftTd>
                  <ASoftTd numeric>
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
                        <>
                          <AButton
                            type="button"
                            size="sm"
                            onClick={() => void onCertificate(row.id)}
                          >
                            Télécharger
                          </AButton>
                          {row.arInvoiceId ? (
                            <AButton
                              type="button"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void onPrepareInvoicePack(row.arInvoiceId!)
                              }
                            >
                              XML facture
                            </AButton>
                          ) : null}
                        </>
                      ) : null}
                      {row.status === "TEJ_PREPARED" ? (
                        <AButton
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => void onAckImport(row.id)}
                        >
                          Accusé import
                        </AButton>
                      ) : null}
                      {row.status === "TRANSMITTED" ? (
                        <>
                          <AButton
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void onAcceptTej(row.id)}
                          >
                            Accepté Tej
                          </AButton>
                          <AButton
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              setRejectId(row.id);
                              setRejectReason("");
                            }}
                          >
                            Rejeté Tej
                          </AButton>
                        </>
                      ) : null}
                      {row.status === "ACCEPTED" ||
                      row.status === "REJECTED" ? (
                        <AButton
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => void onArchive(row.id)}
                        >
                          Archiver
                        </AButton>
                      ) : null}
                      {row.status === "REJECTED" && row.tejRejectReason ? (
                        <span className="text-[length:var(--a-text-xs)] text-a-danger">
                          {row.tejRejectReason}
                        </span>
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
                      row.status !== "CERTIFICATE_READY" &&
                      row.status !== "TEJ_PREPARED" &&
                      row.status !== "TRANSMITTED" &&
                      row.status !== "ACCEPTED" &&
                      row.status !== "REJECTED" ? (
                        <span className="text-a-fg-muted">—</span>
                      ) : null}
                    </div>
                  </ASoftTd>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        ) : null}
      </APageBody>

      <ADrawer
        open={rejectId != null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectId(null);
            setRejectReason("");
          }
        }}
        title="Rejet Tej (local)"
        description="Enregistre le rejet signalé par la plateforme Tej — AUTHORITY ne transmet rien."
      >
        <div className="space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Motif de rejet
            </span>
            <AInput
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex. anomalie XSD / ligne refusée"
            />
          </label>
          <AButton
            type="button"
            size="sm"
            disabled={busy || !rejectReason.trim()}
            onClick={() => void onConfirmReject()}
          >
            Enregistrer rejet
          </AButton>
        </div>
      </ADrawer>

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
              <p className="text-a-fg-muted">{detectPreview.decisionReason}</p>
              <p className="a-mono a-tabular">
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
