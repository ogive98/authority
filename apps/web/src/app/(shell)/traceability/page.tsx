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
  fetchLots,
  fetchRecalls,
  fetchLotTree,
  createLot,
  createRecall,
  completeRecall,
  type TrcLot,
  type TrcRecall,
  type LotTree,
} from "@/lib/traceability";

type Tab = "lots" | "genealogy" | "recalls";
const TABS = [
  { id: "lots", label: "Lots" },
  { id: "genealogy", label: "Généalogie" },
  { id: "recalls", label: "Rappels" },
] as const;

type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ok"; items: T[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function TraceabilityWorkspace() {
  const [tab, setTab] = useState<Tab>("lots");
  const [lots, setLots] = useState<LoadState<TrcLot>>({ kind: "loading" });
  const [recalls, setRecalls] = useState<LoadState<TrcRecall>>({ kind: "loading" });
  const [tree, setTree] = useState<LotTree | null>(null);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [lotForm, setLotForm] = useState({ lotCode: "", productId: "", productionDate: "", expiryDate: "" });
  const [recallForm, setRecallForm] = useState({ lotId: "", reason: "", initiatedBy: "" });
  const [treeLotId, setTreeLotId] = useState("");

  const loadLots = useCallback(async () => {
    setLots({ kind: "loading" });
    const res = await fetchLots();
    if (!res.ok) { setLots(res.status === 403 ? { kind: "forbidden", message: res.message } : { kind: "error", message: res.message }); return; }
    setLots({ kind: "ok", items: res.data });
  }, []);
  const loadRecalls = useCallback(async () => {
    setRecalls({ kind: "loading" });
    const res = await fetchRecalls();
    if (!res.ok) { setRecalls(res.status === 403 ? { kind: "forbidden", message: res.message } : { kind: "error", message: res.message }); return; }
    setRecalls({ kind: "ok", items: res.data });
  }, []);

  useEffect(() => { void loadLots(); void loadRecalls(); }, [loadLots, loadRecalls]);

  const count = tab === "lots" ? (lots.kind === "ok" ? lots.items.length : 0) : tab === "recalls" ? (recalls.kind === "ok" ? recalls.items.length : 0) : 0;

  async function onViewTree(lotId: string) {
    setTreeLotId(lotId);
    const res = await fetchLotTree(lotId);
    if (res.ok) setTree(res.data);
    setTab("genealogy");
  }

  async function onCreateLot() {
    setBusy(true); setFormError(null);
    const res = await createLot({ lotCode: lotForm.lotCode, productId: lotForm.productId, productionDate: lotForm.productionDate || undefined, expiryDate: lotForm.expiryDate || undefined });
    setBusy(false);
    if (!res.ok) { setFormError(res.message); return; }
    setDrawerOpen(false); setLotForm({ lotCode: "", productId: "", productionDate: "", expiryDate: "" });
    void loadLots();
  }

  async function onCreateRecall() {
    setBusy(true); setFormError(null);
    const res = await createRecall({ lotId: recallForm.lotId, reason: recallForm.reason, initiatedBy: recallForm.initiatedBy });
    setBusy(false);
    if (!res.ok) { setFormError(res.message); return; }
    setDrawerOpen(false); setRecallForm({ lotId: "", reason: "", initiatedBy: "" });
    void loadRecalls();
  }

  async function onCompleteRecall(id: string) {
    const res = await completeRecall(id);
    if (res.ok) void loadRecalls();
  }

  const filteredLots = lots.kind === "ok" ? lots.items.filter((l) => !search || l.lotCode.toLowerCase().includes(search.toLowerCase())) : [];

  return (
    <>
      <AScreenHeader kicker="Traçabilité" title="Lots et rappels" description={erpListDescription(count, tab === "lots" ? "lot" : tab === "recalls" ? "rappel" : "lien")} primary={<AButton onClick={() => { setFormError(null); setDrawerOpen(true); }}>Nouveau</AButton>} />
      <APageBody>
        <ATabs items={TABS} value={tab} onValueChange={(id) => setTab(id as Tab)} variant="underline" ariaLabel="Onglets traçabilité" />
        <AFilterBar search={<AInput placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />} utilities={<AListUtilities />} />
        {tab === "lots" && (
          lots.kind === "loading" ? <ASkeleton /> :
          lots.kind === "forbidden" ? <AForbiddenState message={lots.message} /> :
          lots.kind === "error" ? <AErrorState message="Erreur de chargement." retryable onRetry={loadLots} /> :
          lots.items.length === 0 ? <AEmptyState title="Aucun lot" description="Créez un lot de production pour commencer." /> :
          <ASoftTable className="min-w-[48rem]">
            <ASoftThead><tr><ASoftTh>Code</ASoftTh><ASoftTh>Produit</ASoftTh><ASoftTh>Production</ASoftTh><ASoftTh>Expiration</ASoftTh><ASoftTh>Généalogie</ASoftTh></tr></ASoftThead>
            <tbody>{filteredLots.map((l) => (
              <ASoftTr key={l.id}>
                <ASoftTd className="a-mono font-medium">{l.lotCode}</ASoftTd>
                <ASoftTd className="a-mono text-a-fg-muted">{l.productId.slice(0, 8)}</ASoftTd>
                <ASoftTd className="a-mono text-a-fg-subtle">{l.productionDate ? new Date(l.productionDate).toLocaleDateString("fr-TN") : "—"}</ASoftTd>
                <ASoftTd className="a-mono text-a-fg-subtle">{l.expiryDate ? new Date(l.expiryDate).toLocaleDateString("fr-TN") : "—"}</ASoftTd>
                <ASoftTd><AButton size="sm" variant="ghost" onClick={() => void onViewTree(l.id)}>Voir</AButton></ASoftTd>
              </ASoftTr>
            ))}</tbody>
          </ASoftTable>
        )}
        {tab === "genealogy" && (
          !tree ? <AEmptyState title="Généalogie" description="Sélectionnez un lot depuis l'onglet Lots pour voir sa généalogie." /> :
          <div className="space-y-6">
            <div className="rounded-[var(--a-radius-md)] border border-a-stroke p-4">
              <p className="text-[length:var(--a-text-sm)] font-medium">Lot {tree.lot.lotCode}</p>
              <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">{tree.lot.id}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[var(--a-radius-md)] border border-a-stroke p-4">
                <h3 className="text-[length:var(--a-text-sm)] font-medium">Parents ({tree.parents.length})</h3>
                <ul className="mt-2 space-y-1">{tree.parents.map((p, i) => (
                  <li key={i} className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">{p.lot.lotCode} — {p.qty}</li>
                ))}</ul>
              </div>
              <div className="rounded-[var(--a-radius-md)] border border-a-stroke p-4">
                <h3 className="text-[length:var(--a-text-sm)] font-medium">Enfants ({tree.children.length})</h3>
                <ul className="mt-2 space-y-1">{tree.children.map((c, i) => (
                  <li key={i} className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">{c.lot.lotCode} — {c.qty}</li>
                ))}</ul>
              </div>
            </div>
          </div>
        )}
        {tab === "recalls" && (
          recalls.kind === "loading" ? <ASkeleton /> :
          recalls.kind === "forbidden" ? <AForbiddenState message={recalls.message} /> :
          recalls.kind === "error" ? <AErrorState message="Erreur de chargement." retryable onRetry={loadRecalls} /> :
          recalls.items.length === 0 ? <AEmptyState title="Aucun rappel" description="Aucun rappel de produit en cours." /> :
          <ASoftTable className="min-w-[44rem]">
            <ASoftThead><tr><ASoftTh>Lot</ASoftTh><ASoftTh>Motif</ASoftTh><ASoftTh>Statut</ASoftTh><ASoftTh>Date</ASoftTh><ASoftTh>Action</ASoftTh></tr></ASoftThead>
            <tbody>{recalls.kind === "ok" ? recalls.items.filter((r) => !search || r.reason.toLowerCase().includes(search.toLowerCase())).map((r) => (
              <ASoftTr key={r.id}>
                <ASoftTd className="a-mono">{r.lotId.slice(0, 8)}</ASoftTd>
                <ASoftTd>{r.reason}</ASoftTd>
                <ASoftTd><ABadge tone={r.status === "COMPLETED" ? "success" : r.status === "IN_PROGRESS" ? "warning" : "danger"}>{r.status}</ABadge></ASoftTd>
                <ASoftTd className="a-mono text-a-fg-subtle">{new Date(r.createdAt).toLocaleDateString("fr-TN")}</ASoftTd>
                <ASoftTd>{r.status !== "COMPLETED" ? <AButton size="sm" variant="secondary" onClick={() => void onCompleteRecall(r.id)}>Clôturer</AButton> : "—"}</ASoftTd>
              </ASoftTr>
            )) : null}</tbody>
          </ASoftTable>
        )}
      </APageBody>
      <ADrawer open={drawerOpen} onOpenChange={setDrawerOpen} title={tab === "recalls" ? "Nouveau rappel" : "Nouveau lot"} description="Traçabilité" footer={
        <div className="flex flex-wrap justify-end gap-2">
          <AButton variant="secondary" onClick={() => setDrawerOpen(false)}>Annuler</AButton>
          <AButton onClick={() => void (tab === "recalls" ? onCreateRecall() : onCreateLot())} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</AButton>
        </div>
      }>
        <div className="space-y-5 p-4">
          {formError ? <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">{formError}</p> : null}
          {tab === "recalls" ? (
            <AFormSection title="Rappel">
              <AField label="ID lot"><AInput value={recallForm.lotId} onChange={(e) => setRecallForm({ ...recallForm, lotId: e.target.value })} /></AField>
              <AField label="Motif"><AInput value={recallForm.reason} onChange={(e) => setRecallForm({ ...recallForm, reason: e.target.value })} /></AField>
              <AField label="Initié par"><AInput value={recallForm.initiatedBy} onChange={(e) => setRecallForm({ ...recallForm, initiatedBy: e.target.value })} /></AField>
            </AFormSection>
          ) : (
            <AFormSection title="Lot">
              <AField label="Code lot"><AInput value={lotForm.lotCode} onChange={(e) => setLotForm({ ...lotForm, lotCode: e.target.value })} /></AField>
              <AField label="ID produit"><AInput value={lotForm.productId} onChange={(e) => setLotForm({ ...lotForm, productId: e.target.value })} /></AField>
              <AField label="Date production"><AInput type="date" value={lotForm.productionDate} onChange={(e) => setLotForm({ ...lotForm, productionDate: e.target.value })} /></AField>
              <AField label="Date expiration"><AInput type="date" value={lotForm.expiryDate} onChange={(e) => setLotForm({ ...lotForm, expiryDate: e.target.value })} /></AField>
            </AFormSection>
          )}
        </div>
      </ADrawer>
    </>
  );
}

export default function TraceabilityPage() {
  return <Suspense fallback={<ASkeleton />}><TraceabilityWorkspace /></Suspense>;
}
