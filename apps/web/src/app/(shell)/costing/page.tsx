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
  AButton,
  ADrawer,
  AField,
  AFormSection,
  AEmptyState,
  AErrorState,
  AForbiddenState,
} from "@/components/a";
import {
  fetchRolls,
  runRollup,
  fetchProductCost,
  type CostRoll,
  type ProductCost,
} from "@/lib/costing";

type Tab = "rolls" | "products";
const TABS = [
  { id: "rolls", label: "Rollups" },
  { id: "products", label: "Coûts produit" },
] as const;

type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ok"; items: T[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function CostingWorkspace() {
  const [tab, setTab] = useState<Tab>("rolls");
  const [rolls, setRolls] = useState<LoadState<CostRoll>>({ kind: "loading" });
  const [productCost, setProductCost] = useState<ProductCost | null>(null);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [period, setPeriod] = useState("");
  const [productId, setProductId] = useState("");

  const loadRolls = useCallback(async () => {
    setRolls({ kind: "loading" });
    const res = await fetchRolls();
    if (!res.ok) { setRolls(res.status === 403 ? { kind: "forbidden", message: res.message } : { kind: "error", message: res.message }); return; }
    setRolls({ kind: "ok", items: res.data });
  }, []);

  useEffect(() => { void loadRolls(); }, [loadRolls]);

  const count = rolls.kind === "ok" ? rolls.items.length : 0;

  async function onRunRollup() {
    if (!period) return;
    setBusy(true); setFormError(null);
    const res = await runRollup(period);
    setBusy(false);
    if (!res.ok) { setFormError(res.message); return; }
    setDrawerOpen(false); setPeriod("");
    void loadRolls();
  }

  async function onLookupProduct() {
    if (!productId) return;
    const res = await fetchProductCost(productId);
    if (res.ok) setProductCost(res.data);
  }

  const filteredRolls = rolls.kind === "ok" ? rolls.items.filter((r) => !search || r.productId.toLowerCase().includes(search.toLowerCase()) || r.period.includes(search)) : [];

  return (
    <>
      <AScreenHeader kicker="Coûts" title="Coûts de revient" description={erpListDescription(count, "rollup")} primary={<AButton onClick={() => { setFormError(null); setDrawerOpen(true); }}>Lancer rollup</AButton>} />
      <APageBody>
        <ATabs items={TABS} value={tab} onValueChange={(id) => setTab(id as Tab)} variant="underline" ariaLabel="Onglets coûts" />
        <AFilterBar search={<AInput placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />} utilities={<AListUtilities />} />
        {tab === "rolls" && (
          rolls.kind === "loading" ? <ASkeleton /> :
          rolls.kind === "forbidden" ? <AForbiddenState message={rolls.message} /> :
          rolls.kind === "error" ? <AErrorState message="Erreur de chargement." retryable onRetry={loadRolls} /> :
          rolls.items.length === 0 ? <AEmptyState title="Aucun rollup" description="Lancez un calcul de coût de revient pour commencer." /> :
          <ASoftTable className="min-w-[44rem]">
            <ASoftThead><tr><ASoftTh>Produit</ASoftTh><ASoftTh>Période</ASoftTh><ASoftTh>Coût std</ASoftTh><ASoftTh>Date</ASoftTh></tr></ASoftThead>
            <tbody>{filteredRolls.map((r) => (
              <ASoftTr key={r.id}>
                <ASoftTd className="a-mono">{r.productId.slice(0, 8)}</ASoftTd>
                <ASoftTd className="a-mono">{r.period}</ASoftTd>
                <ASoftTd className="a-mono a-tabular">{Number(r.stdCost).toLocaleString("fr-TN", { minimumFractionDigits: 3 })} TND</ASoftTd>
                <ASoftTd className="a-mono text-a-fg-subtle">{new Date(r.postedAt).toLocaleDateString("fr-TN")}</ASoftTd>
              </ASoftTr>
            ))}</tbody>
          </ASoftTable>
        )}
        {tab === "products" && (
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <AField label="ID produit"><AInput value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="UUID du produit" /></AField>
              <AButton onClick={() => void onLookupProduct()}>Consulter</AButton>
            </div>
            {!productCost ? <AEmptyState title="Coût produit" description="Recherchez un produit pour voir son coût de revient." /> :
            <div className="rounded-[var(--a-radius-md)] border border-a-stroke p-4">
              <p className="text-[length:var(--a-text-sm)] font-medium">{productCost.product.sku} — {productCost.product.name}</p>
              <p className="a-mono mt-1 text-[length:var(--a-text-lg)] font-semibold">{Number(productCost.stdCost).toLocaleString("fr-TN", { minimumFractionDigits: 3 })} TND</p>
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">Période : {productCost.period}</p>
            </div>}
          </div>
        )}
      </APageBody>
      <ADrawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Lancer un rollup" description="Calcul du coût de revient standard" footer={
        <div className="flex flex-wrap justify-end gap-2">
          <AButton variant="secondary" onClick={() => setDrawerOpen(false)}>Annuler</AButton>
          <AButton onClick={() => void onRunRollup()} disabled={busy}>{busy ? "Calcul…" : "Calculer"}</AButton>
        </div>
      }>
        <div className="space-y-5 p-4">
          {formError ? <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">{formError}</p> : null}
          <AFormSection title="Période">
            <AField label="Période (AAAA-MM)"><AInput value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-10" /></AField>
          </AFormSection>
        </div>
      </ADrawer>
    </>
  );
}

export default function CostingPage() {
  return <Suspense fallback={<ASkeleton />}><CostingWorkspace /></Suspense>;
}
