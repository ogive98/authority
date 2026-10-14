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
  fetchTemplates,
  createTemplate,
  renderLabel,
  fetchPrintLogs,
  type LblTemplate,
  type LblPrintLog,
} from "@/lib/labels";

type Tab = "templates" | "render" | "logs";
const TABS = [
  { id: "templates", label: "Modèles" },
  { id: "render", label: "Rendu ZPL" },
  { id: "logs", label: "Historique" },
] as const;

type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ok"; items: T[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function LabelsWorkspace() {
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<LoadState<LblTemplate>>({ kind: "loading" });
  const [logs, setLogs] = useState<LoadState<LblPrintLog>>({ kind: "loading" });
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [tplForm, setTplForm] = useState({ code: "", name: "", zpl: "", widthMm: 0, heightMm: 0 });
  const [renderForm, setRenderForm] = useState({ templateId: "", lotId: "", printerName: "" });
  const [renderResult, setRenderResult] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setTemplates({ kind: "loading" });
    const res = await fetchTemplates();
    if (!res.ok) { setTemplates(res.status === 403 ? { kind: "forbidden", message: res.message } : { kind: "error", message: res.message }); return; }
    setTemplates({ kind: "ok", items: res.data });
  }, []);
  const loadLogs = useCallback(async () => {
    setLogs({ kind: "loading" });
    const res = await fetchPrintLogs();
    if (!res.ok) { setLogs(res.status === 403 ? { kind: "forbidden", message: res.message } : { kind: "error", message: res.message }); return; }
    setLogs({ kind: "ok", items: res.data });
  }, []);

  useEffect(() => { void loadTemplates(); void loadLogs(); }, [loadTemplates, loadLogs]);

  const count = tab === "templates" ? (templates.kind === "ok" ? templates.items.length : 0) : tab === "logs" ? (logs.kind === "ok" ? logs.items.length : 0) : 0;

  async function onCreateTemplate() {
    setBusy(true); setFormError(null);
    const res = await createTemplate({ code: tplForm.code, name: tplForm.name, zpl: tplForm.zpl, widthMm: tplForm.widthMm, heightMm: tplForm.heightMm });
    setBusy(false);
    if (!res.ok) { setFormError(res.message); return; }
    setDrawerOpen(false); setTplForm({ code: "", name: "", zpl: "", widthMm: 0, heightMm: 0 });
    void loadTemplates();
  }

  async function onRender() {
    if (!renderForm.templateId) return;
    setBusy(true); setFormError(null); setRenderResult(null);
    const res = await renderLabel({ templateId: renderForm.templateId, lotId: renderForm.lotId || undefined, printerName: renderForm.printerName || undefined });
    setBusy(false);
    if (!res.ok) { setFormError(res.message); return; }
    setRenderResult(res.data.zpl);
    void loadLogs();
  }

  const filteredTemplates = templates.kind === "ok" ? templates.items.filter((t) => !search || t.code.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase())) : [];

  return (
    <>
      <AScreenHeader kicker="Étiquettes" title="Label Engine" description={erpListDescription(count, tab === "templates" ? "modèle" : tab === "logs" ? "impression" : "rendu")} primary={tab === "templates" ? <AButton onClick={() => { setFormError(null); setDrawerOpen(true); }}>Nouveau modèle</AButton> : undefined} />
      <APageBody>
        <ATabs items={TABS} value={tab} onValueChange={(id) => setTab(id as Tab)} variant="underline" ariaLabel="Onglets étiquettes" />
        <AFilterBar search={<AInput placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />} utilities={<AListUtilities />} />
        {tab === "templates" && (
          templates.kind === "loading" ? <ASkeleton /> :
          templates.kind === "forbidden" ? <AForbiddenState message={templates.message} /> :
          templates.kind === "error" ? <AErrorState message="Erreur de chargement." retryable onRetry={loadTemplates} /> :
          templates.items.length === 0 ? <AEmptyState title="Aucun modèle" description="Créez un modèle d'étiquette ZPL." /> :
          <ASoftTable className="min-w-[48rem]">
            <ASoftThead><tr><ASoftTh>Code</ASoftTh><ASoftTh>Nom</ASoftTh><ASoftTh>Dimensions</ASoftTh><ASoftTh>Actif</ASoftTh></tr></ASoftThead>
            <tbody>{filteredTemplates.map((t) => (
              <ASoftTr key={t.id}>
                <ASoftTd className="a-mono font-medium">{t.code}</ASoftTd>
                <ASoftTd>{t.name}</ASoftTd>
                <ASoftTd className="a-mono a-tabular">{t.widthMm} × {t.heightMm} mm</ASoftTd>
                <ASoftTd><ABadge tone={t.active ? "success" : "neutral"}>{t.active ? "Oui" : "Non"}</ABadge></ASoftTd>
              </ASoftTr>
            ))}</tbody>
          </ASoftTable>
        )}
        {tab === "render" && (
          <div className="space-y-4">
            {formError ? <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">{formError}</p> : null}
            <div className="rounded-[var(--a-radius-md)] border border-a-stroke p-4">
              <h3 className="mb-3 text-[length:var(--a-text-sm)] font-medium">Rendu ZPL</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <AField label="ID template"><AInput value={renderForm.templateId} onChange={(e) => setRenderForm({ ...renderForm, templateId: e.target.value })} /></AField>
                <AField label="ID lot (optionnel)"><AInput value={renderForm.lotId} onChange={(e) => setRenderForm({ ...renderForm, lotId: e.target.value })} /></AField>
                <AField label="Imprimante"><AInput value={renderForm.printerName} onChange={(e) => setRenderForm({ ...renderForm, printerName: e.target.value })} /></AField>
              </div>
              <AButton onClick={() => void onRender()} disabled={busy} className="mt-2">{busy ? "Rendu…" : "Générer ZPL"}</AButton>
            </div>
            {renderResult ? (
              <div className="rounded-[var(--a-radius-md)] border border-a-stroke p-4">
                <h3 className="mb-2 text-[length:var(--a-text-sm)] font-medium">ZPL généré</h3>
                <pre className="a-mono max-h-[20rem] overflow-auto rounded-[var(--a-radius-sm)] bg-a-surface-3 p-3 text-[length:var(--a-text-xs)]">{renderResult}</pre>
              </div>
            ) : null}
          </div>
        )}
        {tab === "logs" && (
          logs.kind === "loading" ? <ASkeleton /> :
          logs.kind === "forbidden" ? <AForbiddenState message={logs.message} /> :
          logs.kind === "error" ? <AErrorState message="Erreur de chargement." retryable onRetry={loadLogs} /> :
          logs.items.length === 0 ? <AEmptyState title="Aucune impression" description="L'historique des impressions apparaîtra ici." /> :
          <ASoftTable className="min-w-[44rem]">
            <ASoftThead><tr><ASoftTh>Template</ASoftTh><ASoftTh>Lot</ASoftTh><ASoftTh>Statut</ASoftTh><ASoftTh>Imprimante</ASoftTh><ASoftTh>Date</ASoftTh></tr></ASoftThead>
            <tbody>{logs.kind === "ok" ? logs.items.filter((l) => !search || l.status.toLowerCase().includes(search.toLowerCase())).map((l) => (
              <ASoftTr key={l.id}>
                <ASoftTd className="a-mono">{l.templateId.slice(0, 8)}</ASoftTd>
                <ASoftTd className="a-mono">{l.lotId ? l.lotId.slice(0, 8) : "—"}</ASoftTd>
                <ASoftTd><ABadge tone={l.status === "SUCCESS" ? "success" : "warning"}>{l.status}</ABadge></ASoftTd>
                <ASoftTd>{l.printerName ?? "—"}</ASoftTd>
                <ASoftTd className="a-mono text-a-fg-subtle">{new Date(l.printedAt).toLocaleDateString("fr-TN")}</ASoftTd>
              </ASoftTr>
            )) : null}</tbody>
          </ASoftTable>
        )}
      </APageBody>
      <ADrawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Nouveau modèle" description="Template d'étiquette ZPL" footer={
        <div className="flex flex-wrap justify-end gap-2">
          <AButton variant="secondary" onClick={() => setDrawerOpen(false)}>Annuler</AButton>
          <AButton onClick={() => void onCreateTemplate()} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</AButton>
        </div>
      }>
        <div className="space-y-5 p-4">
          {formError ? <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">{formError}</p> : null}
          <AFormSection title="Modèle">
            <AField label="Code"><AInput value={tplForm.code} onChange={(e) => setTplForm({ ...tplForm, code: e.target.value })} /></AField>
            <AField label="Nom"><AInput value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} /></AField>
            <AField label="ZPL"><AInput value={tplForm.zpl} onChange={(e) => setTplForm({ ...tplForm, zpl: e.target.value })} /></AField>
            <div className="grid grid-cols-2 gap-3">
              <AField label="Largeur (mm)"><AInput type="number" value={String(tplForm.widthMm)} onChange={(e) => setTplForm({ ...tplForm, widthMm: Number(e.target.value) || 0 })} /></AField>
              <AField label="Hauteur (mm)"><AInput type="number" value={String(tplForm.heightMm)} onChange={(e) => setTplForm({ ...tplForm, heightMm: Number(e.target.value) || 0 })} /></AField>
            </div>
          </AFormSection>
        </div>
      </ADrawer>
    </>
  );
}

export default function LabelsPage() {
  return <Suspense fallback={<ASkeleton />}><LabelsWorkspace /></Suspense>;
}
