"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import {
  APageBody,
  AScreenHeader,
  ASkeleton,
  ATabs,
  AFilterBar,
  AInput,
  AListUtilities,
  erpListDescription,
  ASoftTable,
  ASoftThead,
  ASoftTr,
  ASoftTh,
  ASoftTd,
  ABadge,
  AButton,
  ADrawer,
  AField,
  AFormSection,
  AEmptyState,
  AErrorState,
  AForbiddenState,
} from "@/components/a";
import {
  fetchChecks,
  fetchNcrs,
  createCheck,
  createNcr,
  closeNcr,
  type QcCheck,
  type QuaNcr,
  type CheckTarget,
  type CheckResult,
  type NcrSeverity,
} from "@/lib/quality";
import { softSelect } from "@/lib/d294-ui";

type Tab = "checks" | "ncr" | "holds";
const TABS = [
  { id: "checks", label: "Contrôles QC" },
  { id: "ncr", label: "NCR" },
  { id: "holds", label: "Lots bloqués" },
] as const;

type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ok"; items: T[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function toneForCheck(r: CheckResult) {
  return r === "PASSED" ? "success" : r === "FAILED" ? "danger" : "warning";
}
function toneForNcr(s: NcrSeverity) {
  return s === "CRITICAL" ? "danger" : s === "MAJOR" ? "warning" : "neutral";
}

function QualityWorkspace() {
  const [tab, setTab] = useState<Tab>("checks");
  const [checks, setChecks] = useState<LoadState<QcCheck>>({ kind: "loading" });
  const [ncrs, setNcrs] = useState<LoadState<QuaNcr>>({ kind: "loading" });
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [checkForm, setCheckForm] = useState({ target: "RECEIPT" as CheckTarget, targetId: "", lotId: "", result: "PENDING" as CheckResult, notes: "" });
  const [ncrForm, setNcrForm] = useState({ severity: "MINOR" as NcrSeverity, description: "", lotId: "" });

  const loadChecks = useCallback(async () => {
    setChecks({ kind: "loading" });
    const res = await fetchChecks();
    if (!res.ok) { setChecks(res.status === 403 ? { kind: "forbidden", message: res.message } : { kind: "error", message: res.message }); return; }
    setChecks({ kind: "ok", items: res.data });
  }, []);

  const loadNcrs = useCallback(async () => {
    setNcrs({ kind: "loading" });
    const res = await fetchNcrs();
    if (!res.ok) { setNcrs(res.status === 403 ? { kind: "forbidden", message: res.message } : { kind: "error", message: res.message }); return; }
    setNcrs({ kind: "ok", items: res.data });
  }, []);

  useEffect(() => { void loadChecks(); void loadNcrs(); }, [loadChecks, loadNcrs]);

  const count = tab === "checks" ? (checks.kind === "ok" ? checks.items.length : 0) : tab === "ncr" ? (ncrs.kind === "ok" ? ncrs.items.length : 0) : 0;

  async function onCreateCheck() {
    setBusy(true); setFormError(null);
    const res = await createCheck({ target: checkForm.target, targetId: checkForm.targetId, lotId: checkForm.lotId || undefined, result: checkForm.result, notes: checkForm.notes || undefined });
    setBusy(false);
    if (!res.ok) { setFormError(res.message); return; }
    setDrawerOpen(false); setCheckForm({ target: "RECEIPT", targetId: "", lotId: "", result: "PENDING", notes: "" });
    void loadChecks();
  }

  async function onCreateNcr() {
    setBusy(true); setFormError(null);
    const res = await createNcr({ severity: ncrForm.severity, description: ncrForm.description, lotId: ncrForm.lotId || undefined });
    setBusy(false);
    if (!res.ok) { setFormError(res.message); return; }
    setDrawerOpen(false); setNcrForm({ severity: "MINOR", description: "", lotId: "" });
    void loadNcrs();
  }

  async function onCloseNcr(ncr: QuaNcr) {
    const closedBy = prompt("ID du responsable de clôture :");
    const disposition = prompt("Disposition (rebut, reclassification, retour fournisseur) :");
    if (!closedBy || !disposition) return;
    const res = await closeNcr(ncr.id, { disposition, closedBy });
    if (res.ok) void loadNcrs();
  }

  const filtered = <T extends { id: string }>(items: T[]): T[] => {
    if (!search) return items;
    return items.filter((i) => i.id.toLowerCase().includes(search.toLowerCase()));
  };

  return (
    <>
      <AScreenHeader
        kicker="Qualité"
        title="Contrôle qualité"
        description={erpListDescription(count, tab === "checks" ? "contrôle" : tab === "ncr" ? "NCR" : "lot bloqué")}
        primary={tab !== "holds" ? <AButton onClick={() => { setFormError(null); setDrawerOpen(true); }}>Déclarer</AButton> : undefined}
      />
      <APageBody>
        <ATabs items={TABS} value={tab} onValueChange={(id) => setTab(id as Tab)} variant="underline" ariaLabel="Onglets qualité" />
        <AFilterBar
          search={<AInput placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />}
          utilities={<AListUtilities />}
        />
        {tab === "checks" && (
          checks.kind === "loading" ? <ASkeleton /> :
          checks.kind === "forbidden" ? <AForbiddenState message={checks.message} /> :
          checks.kind === "error" ? <AErrorState message="Erreur de chargement." retryable onRetry={loadChecks} /> :
          checks.items.length === 0 ? <AEmptyState title="Aucun contrôle" description="Créez un contrôle qualité pour commencer." /> :
          <ASoftTable className="min-w-[48rem]">
            <ASoftThead><tr><ASoftTh>Target</ASoftTh><ASoftTh>Résultat</ASoftTh><ASoftTh>Notes</ASoftTh><ASoftTh>Date</ASoftTh></tr></ASoftThead>
            <tbody>{filtered(checks.items).map((c) => (
              <ASoftTr key={c.id}>
                <ASoftTd className="a-mono">{c.target}</ASoftTd>
                <ASoftTd><ABadge tone={toneForCheck(c.result)}>{c.result}</ABadge></ASoftTd>
                <ASoftTd className="text-a-fg-muted">{c.notes ?? "—"}</ASoftTd>
                <ASoftTd className="a-mono text-a-fg-subtle">{new Date(c.createdAt).toLocaleDateString("fr-TN")}</ASoftTd>
              </ASoftTr>
            ))}</tbody>
          </ASoftTable>
        )}
        {tab === "ncr" && (
          ncrs.kind === "loading" ? <ASkeleton /> :
          ncrs.kind === "forbidden" ? <AForbiddenState message={ncrs.message} /> :
          ncrs.kind === "error" ? <AErrorState message="Erreur de chargement." retryable onRetry={loadNcrs} /> :
          ncrs.items.length === 0 ? <AEmptyState title="Aucune NCR" description="Aucune non-conformité enregistrée." /> :
          <ASoftTable className="min-w-[48rem]">
            <ASoftThead><tr><ASoftTh>Sévérité</ASoftTh><ASoftTh>Description</ASoftTh><ASoftTh>Statut</ASoftTh><ASoftTh>Disposition</ASoftTh><ASoftTh>Action</ASoftTh></tr></ASoftThead>
            <tbody>{filtered(ncrs.items).map((n) => (
              <ASoftTr key={n.id}>
                <ASoftTd><ABadge tone={toneForNcr(n.severity)}>{n.severity}</ABadge></ASoftTd>
                <ASoftTd>{n.description}</ASoftTd>
                <ASoftTd><ABadge tone={n.status === "CLOSED" ? "success" : "warning"}>{n.status}</ABadge></ASoftTd>
                <ASoftTd className="text-a-fg-muted">{n.disposition ?? "—"}</ASoftTd>
                <ASoftTd>{n.status !== "CLOSED" ? <AButton size="sm" variant="secondary" onClick={() => void onCloseNcr(n)}>Clôturer</AButton> : "—"}</ASoftTd>
              </ASoftTr>
            ))}</tbody>
          </ASoftTable>
        )}
        {tab === "holds" && (
          <AEmptyState title="Lots bloqués" description="Utilisez les contrôles QC pour bloquer/libérer des lots via l'API." />
        )}
      </APageBody>
      <ADrawer open={drawerOpen} onOpenChange={setDrawerOpen} title={tab === "checks" ? "Nouveau contrôle QC" : "Nouvelle NCR"} description="Déclaration qualité" footer={
        <div className="flex flex-wrap justify-end gap-2">
          <AButton variant="secondary" onClick={() => setDrawerOpen(false)}>Annuler</AButton>
          <AButton onClick={() => void (tab === "checks" ? onCreateCheck() : onCreateNcr())} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</AButton>
        </div>
      }>
        <div className="space-y-5 p-4">
          {formError ? <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">{formError}</p> : null}
          {tab === "checks" ? (
            <AFormSection title="Contrôle">
              <AField label="Cible"><select className={softSelect} value={checkForm.target} onChange={(e) => setCheckForm({ ...checkForm, target: e.target.value as CheckTarget })}><option value="RECEIPT">Réception</option><option value="PRODUCTION">Production</option></select></AField>
              <AField label="ID cible"><AInput value={checkForm.targetId} onChange={(e) => setCheckForm({ ...checkForm, targetId: e.target.value })} placeholder="ID du document" /></AField>
              <AField label="ID lot (optionnel)"><AInput value={checkForm.lotId} onChange={(e) => setCheckForm({ ...checkForm, lotId: e.target.value })} /></AField>
              <AField label="Résultat"><select className={softSelect} value={checkForm.result} onChange={(e) => setCheckForm({ ...checkForm, result: e.target.value as CheckResult })}><option value="PENDING">En attente</option><option value="PASSED">Conforme</option><option value="FAILED">Non conforme</option></select></AField>
              <AField label="Notes"><AInput value={checkForm.notes} onChange={(e) => setCheckForm({ ...checkForm, notes: e.target.value })} /></AField>
            </AFormSection>
          ) : (
            <AFormSection title="Non-conformité">
              <AField label="Sévérité"><select className={softSelect} value={ncrForm.severity} onChange={(e) => setNcrForm({ ...ncrForm, severity: e.target.value as NcrSeverity })}><option value="MINOR">Mineure</option><option value="MAJOR">Majeure</option><option value="CRITICAL">Critique</option></select></AField>
              <AField label="Description"><AInput value={ncrForm.description} onChange={(e) => setNcrForm({ ...ncrForm, description: e.target.value })} /></AField>
              <AField label="ID lot (optionnel)"><AInput value={ncrForm.lotId} onChange={(e) => setNcrForm({ ...ncrForm, lotId: e.target.value })} /></AField>
            </AFormSection>
          )}
        </div>
      </ADrawer>
    </>
  );
}

export default function QualityPage() {
  return <Suspense fallback={<ASkeleton />}><QualityWorkspace /></Suspense>;
}
