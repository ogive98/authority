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
  fetchRecipes,
  createRecipe,
  addRecipeLines,
  activateRecipe,
  type BomRecipe,
  type RecipeStatus,
} from "@/lib/bom";

type Tab = "recipes" | "lines";
const TABS = [
  { id: "recipes", label: "Recettes" },
  { id: "lines", label: "Lignes" },
] as const;

type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ok"; items: T[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function toneForStatus(s: RecipeStatus) {
  return s === "ACTIVE" ? "success" : s === "OBSOLETE" ? "neutral" : "warning";
}

function BomWorkspace() {
  const [tab, setTab] = useState<Tab>("recipes");
  const [recipes, setRecipes] = useState<LoadState<BomRecipe>>({ kind: "loading" });
  const [selected, setSelected] = useState<BomRecipe | null>(null);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [recipeForm, setRecipeForm] = useState({ productId: "", version: 1, yield: "", notes: "" });
  const [lineForm, setLineForm] = useState({ productId: "", qty: "", uom: "", scrapPct: "", step: "" });

  const load = useCallback(async () => {
    setRecipes({ kind: "loading" });
    const res = await fetchRecipes();
    if (!res.ok) { setRecipes(res.status === 403 ? { kind: "forbidden", message: res.message } : { kind: "error", message: res.message }); return; }
    setRecipes({ kind: "ok", items: res.data });
  }, []);

  useEffect(() => { void load(); }, [load]);

  const count = recipes.kind === "ok" ? recipes.items.length : 0;
  const filtered = recipes.kind === "ok" ? recipes.items.filter((r) => !search || r.number.toLowerCase().includes(search.toLowerCase()) || r.productId.toLowerCase().includes(search.toLowerCase())) : [];

  async function onCreateRecipe() {
    setBusy(true); setFormError(null);
    const res = await createRecipe({ productId: recipeForm.productId, version: recipeForm.version, yield: recipeForm.yield || undefined, notes: recipeForm.notes || undefined });
    setBusy(false);
    if (!res.ok) { setFormError(res.message); return; }
    setDrawerOpen(false); setRecipeForm({ productId: "", version: 1, yield: "", notes: "" });
    void load();
  }

  async function onAddLines(recipeId: string) {
    if (!lineForm.productId || !lineForm.qty || !lineForm.uom) return;
    setBusy(true); setFormError(null);
    const res = await addRecipeLines(recipeId, [{ productId: lineForm.productId, qty: lineForm.qty, uom: lineForm.uom, scrapPct: lineForm.scrapPct || undefined, step: lineForm.step ? Number(lineForm.step) : undefined }]);
    setBusy(false);
    if (!res.ok) { setFormError(res.message); return; }
    setLineForm({ productId: "", qty: "", uom: "", scrapPct: "", step: "" });
    void load();
  }

  async function onActivate(id: string) {
    const res = await activateRecipe(id);
    if (res.ok) void load();
  }

  return (
    <>
      <AScreenHeader kicker="Nomenclatures" title="Recettes de production" description={erpListDescription(count, "recette")} primary={<AButton onClick={() => { setFormError(null); setDrawerOpen(true); }}>Nouvelle recette</AButton>} />
      <APageBody>
        <ATabs items={TABS} value={tab} onValueChange={(id) => setTab(id as Tab)} variant="underline" ariaLabel="Onglets nomenclatures" />
        <AFilterBar search={<AInput placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />} utilities={<AListUtilities />} />
        {tab === "recipes" && (
          recipes.kind === "loading" ? <ASkeleton /> :
          recipes.kind === "forbidden" ? <AForbiddenState message={recipes.message} /> :
          recipes.kind === "error" ? <AErrorState message="Erreur de chargement." retryable onRetry={load} /> :
          recipes.items.length === 0 ? <AEmptyState title="Aucune recette" description="Créez une nomenclature pour un produit fini." /> :
          <ASoftTable className="min-w-[52rem]">
            <ASoftThead><tr><ASoftTh>Numéro</ASoftTh><ASoftTh>Produit</ASoftTh><ASoftTh>Version</ASoftTh><ASoftTh>Statut</ASoftTh><ASoftTh>Rendement</ASoftTh><ASoftTh>Lignes</ASoftTh><ASoftTh>Actions</ASoftTh></tr></ASoftThead>
            <tbody>{filtered.map((r) => (
              <ASoftTr key={r.id}>
                <ASoftTd className="a-mono font-medium">{r.number}</ASoftTd>
                <ASoftTd className="a-mono text-a-fg-muted">{r.productId.slice(0, 8)}</ASoftTd>
                <ASoftTd className="a-tabular">v{r.version}</ASoftTd>
                <ASoftTd><ABadge tone={toneForStatus(r.status)}>{r.status}</ABadge></ASoftTd>
                <ASoftTd className="a-mono a-tabular">{r.yield}</ASoftTd>
                <ASoftTd className="a-tabular">{r.lines.length}</ASoftTd>
                <ASoftTd>
                  <div className="flex gap-1">
                    <AButton size="sm" variant="ghost" onClick={() => { setSelected(r); setTab("lines"); }}>Lignes</AButton>
                    {r.status === "DRAFT" ? <AButton size="sm" variant="secondary" onClick={() => void onActivate(r.id)}>Activer</AButton> : null}
                  </div>
                </ASoftTd>
              </ASoftTr>
            ))}</tbody>
          </ASoftTable>
        )}
        {tab === "lines" && (
          !selected ? <AEmptyState title="Lignes de recette" description="Sélectionnez une recette depuis l'onglet Recettes." /> :
          <>
            <div className="mb-4 rounded-[var(--a-radius-md)] border border-a-stroke p-3">
              <p className="text-[length:var(--a-text-sm)] font-medium">{selected.number} — v{selected.version} <ABadge tone={toneForStatus(selected.status)}>{selected.status}</ABadge></p>
            </div>
            {selected.lines.length === 0 ? <AEmptyState title="Aucune ligne" description="Ajoutez des intrants à cette recette." /> :
            <ASoftTable className="min-w-[44rem]">
              <ASoftThead><tr><ASoftTh>Produit</ASoftTh><ASoftTh>Quantité</ASoftTh><ASoftTh>UoM</ASoftTh><ASoftTh>Perte %</ASoftTh><ASoftTh>Étape</ASoftTh></tr></ASoftThead>
              <tbody>{selected.lines.map((l) => (
                <ASoftTr key={l.id}>
                  <ASoftTd className="a-mono">{l.productId.slice(0, 8)}</ASoftTd>
                  <ASoftTd className="a-mono a-tabular">{l.qty}</ASoftTd>
                  <ASoftTd>{l.uom}</ASoftTd>
                  <ASoftTd className="a-mono a-tabular">{l.scrapPct}</ASoftTd>
                  <ASoftTd className="a-tabular">{l.step ?? "—"}</ASoftTd>
                </ASoftTr>
              ))}</tbody>
            </ASoftTable>}
            <div className="mt-4 rounded-[var(--a-radius-md)] border border-a-stroke p-4">
              <h3 className="mb-3 text-[length:var(--a-text-sm)] font-medium">Ajouter un intrant</h3>
              {formError ? <p className="mb-2 rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">{formError}</p> : null}
              <div className="grid gap-3 sm:grid-cols-5">
                <AField label="ID produit"><AInput value={lineForm.productId} onChange={(e) => setLineForm({ ...lineForm, productId: e.target.value })} /></AField>
                <AField label="Quantité"><AInput value={lineForm.qty} onChange={(e) => setLineForm({ ...lineForm, qty: e.target.value })} /></AField>
                <AField label="UoM"><AInput value={lineForm.uom} onChange={(e) => setLineForm({ ...lineForm, uom: e.target.value })} placeholder="kg, L, unité…" /></AField>
                <AField label="Perte %"><AInput value={lineForm.scrapPct} onChange={(e) => setLineForm({ ...lineForm, scrapPct: e.target.value })} /></AField>
                <AField label="Étape"><AInput value={lineForm.step} onChange={(e) => setLineForm({ ...lineForm, step: e.target.value })} /></AField>
              </div>
              <AButton size="sm" onClick={() => void onAddLines(selected.id)} disabled={busy} className="mt-2">Ajouter</AButton>
            </div>
          </>
        )}
      </APageBody>
      <ADrawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Nouvelle recette" description="Nomenclature de production" footer={
        <div className="flex flex-wrap justify-end gap-2">
          <AButton variant="secondary" onClick={() => setDrawerOpen(false)}>Annuler</AButton>
          <AButton onClick={() => void onCreateRecipe()} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</AButton>
        </div>
      }>
        <div className="space-y-5 p-4">
          {formError ? <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">{formError}</p> : null}
          <AFormSection title="Recette">
            <AField label="ID produit fini"><AInput value={recipeForm.productId} onChange={(e) => setRecipeForm({ ...recipeForm, productId: e.target.value })} /></AField>
            <AField label="Version"><AInput type="number" value={String(recipeForm.version)} onChange={(e) => setRecipeForm({ ...recipeForm, version: Number(e.target.value) || 1 })} /></AField>
            <AField label="Rendement"><AInput value={recipeForm.yield} onChange={(e) => setRecipeForm({ ...recipeForm, yield: e.target.value })} placeholder="ex: 1.000" /></AField>
            <AField label="Notes"><AInput value={recipeForm.notes} onChange={(e) => setRecipeForm({ ...recipeForm, notes: e.target.value })} /></AField>
          </AFormSection>
        </div>
      </ADrawer>
    </>
  );
}

export default function BomPage() {
  return <Suspense fallback={<ASkeleton />}><BomWorkspace /></Suspense>;
}
