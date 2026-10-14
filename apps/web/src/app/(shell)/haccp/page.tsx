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
  ASwitch,
} from "@/components/a";
import {
  fetchCcps,
  fetchRecords,
  fetchAudits,
  createCcp,
  createRecord,
  createAudit,
  type HcpCcp,
  type HcpRecord,
  type HcpAudit,
} from "@/lib/haccp";
import { softSelect } from "@/lib/d294-ui";

type Tab = "ccps" | "records" | "audits";
const TABS = [
  { id: "ccps", label: "CCP" },
  { id: "records", label: "Enregistrements" },
  { id: "audits", label: "Audits" },
] as const;

type LoadState<T> =
  | { kind: "loading" }
  | { kind: "ok"; items: T[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function HaccpWorkspace() {
  const [tab, setTab] = useState<Tab>("ccps");
  const [ccps, setCcps] = useState<LoadState<HcpCcp>>({ kind: "loading" });
  const [records, setRecords] = useState<LoadState<HcpRecord>>({ kind: "loading" });
  const [audits, setAudits] = useState<LoadState<HcpAudit>>({ kind: "loading" });
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [ccpForm, setCcpForm] = useState({ code: "", name: "", criticalLimit: "", unit: "" });
  const [recordForm, setRecordForm] = useState({ ccpId: "", value: "", inSpec: true, recordedBy: "", recordedAt: "", notes: "" });
  const [auditForm, setAuditForm] = useState({ auditDate: "", auditor: "", status: "" });

  const loadCcps = useCallback(async () => {
    setCcps({ kind: "loading" });
    const res = await fetchCcps();
    if (!res.ok) { setCcps(res.status === 403 ? { kind: "forbidden", message: res.message } : { kind: "error", message: res.message }); return; }
    setCcps({ kind: "ok", items: res.data });
  }, []);
  const loadRecords = useCallback(async () => {
    setRecords({ kind: "loading" });
    const res = await fetchRecords();
    if (!res.ok) { setRecords(res.status === 403 ? { kind: "forbidden", message: res.message } : { kind: "error", message: res.message }); return; }
    setRecords({ kind: "ok", items: res.data });
  }, []);
  const loadAudits = useCallback(async () => {
    setAudits({ kind: "loading" });
    const res = await fetchAudits();
    if (!res.ok) { setAudits(res.status === 403 ? { kind: "forbidden", message: res.message } : { kind: "error", message: res.message }); return; }
    setAudits({ kind: "ok", items: res.data });
  }, []);

  useEffect(() => { void loadCcps(); void loadRecords(); void loadAudits(); }, [loadCcps, loadRecords, loadAudits]);

  const current = tab === "ccps" ? ccps : tab === "records" ? records : audits;
  const count = current.kind === "ok" ? current.items.length : 0;

  async function onSubmit() {
    setBusy(true); setFormError(null);
    if (tab === "ccps") {
      const res = await createCcp(ccpForm);
      if (!res.ok) { setBusy(false); setFormError(res.message); return; }
      setCcpForm({ code: "", name: "", criticalLimit: "", unit: "" });
    } else if (tab === "records") {
      const res = await createRecord({ ccpId: recordForm.ccpId, value: recordForm.value, inSpec: recordForm.inSpec, recordedBy: recordForm.recordedBy, recordedAt: recordForm.recordedAt, notes: recordForm.notes || undefined });
      if (!res.ok) { setBusy(false); setFormError(res.message); return; }
      setRecordForm({ ccpId: "", value: "", inSpec: true, recordedBy: "", recordedAt: "", notes: "" });
    } else {
      const res = await createAudit({ auditDate: auditForm.auditDate, auditor: auditForm.auditor, status: auditForm.status || undefined });
      if (!res.ok) { setBusy(false); setFormError(res.message); return; }
      setAuditForm({ auditDate: "", auditor: "", status: "" });
    }
    setBusy(false); setDrawerOpen(false);
    void loadCcps(); void loadRecords(); void loadAudits();
  }

  return (
    <>
      <AScreenHeader kicker="HACCP" title="Points critiques" description={erpListDescription(count, tab === "ccps" ? "CCP" : tab === "records" ? "enregistrement" : "audit")} primary={<AButton onClick={() => { setFormError(null); setDrawerOpen(true); }}>Nouveau</AButton>} />
      <APageBody>
        <ATabs items={TABS} value={tab} onValueChange={(id) => setTab(id as Tab)} variant="underline" ariaLabel="Onglets HACCP" />
        <AFilterBar search={<AInput placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />} utilities={<AListUtilities />} />
        {current.kind === "loading" ? <ASkeleton /> :
         current.kind === "forbidden" ? <AForbiddenState message={current.message} /> :
         current.kind === "error" ? <AErrorState message="Erreur de chargement." retryable onRetry={() => { if (tab === "ccps") void loadCcps(); else if (tab === "records") void loadRecords(); else void loadAudits(); }} /> :
         current.items.length === 0 ? <AEmptyState title={`Aucun ${tab === "ccps" ? "CCP" : tab === "records" ? "enregistrement" : "audit"}`} description="Commencez par créer un point de contrôle." /> :
         tab === "ccps" ? (
          <ASoftTable className="min-w-[48rem]">
            <ASoftThead><tr><ASoftTh>Code</ASoftTh><ASoftTh>Nom</ASoftTh><ASoftTh>Limite</ASoftTh><ASoftTh>Unité</ASoftTh><ASoftTh>Actif</ASoftTh></tr></ASoftThead>
            <tbody>{ccps.kind === "ok" ? ccps.items.map((c) => (
              <ASoftTr key={c.id}>
                <ASoftTd className="a-mono">{c.code}</ASoftTd>
                <ASoftTd>{c.name}</ASoftTd>
                <ASoftTd className="a-mono a-tabular">{c.criticalLimit}</ASoftTd>
                <ASoftTd>{c.unit}</ASoftTd>
                <ASoftTd><ABadge tone={c.active ? "success" : "neutral"}>{c.active ? "Oui" : "Non"}</ABadge></ASoftTd>
              </ASoftTr>
            )) : null}</tbody>
          </ASoftTable>
         ) : tab === "records" ? (
          <ASoftTable className="min-w-[48rem]">
            <ASoftThead><tr><ASoftTh>CCP</ASoftTh><ASoftTh>Valeur</ASoftTh><ASoftTh>Conforme</ASoftTh><ASoftTh>Enregistré par</ASoftTh><ASoftTh>Date</ASoftTh></tr></ASoftThead>
            <tbody>{records.kind === "ok" ? records.items.map((r) => (
              <ASoftTr key={r.id}>
                <ASoftTd className="a-mono">{r.ccpId.slice(0, 8)}</ASoftTd>
                <ASoftTd className="a-mono a-tabular">{r.value}</ASoftTd>
                <ASoftTd><ABadge tone={r.inSpec ? "success" : "danger"}>{r.inSpec ? "Conforme" : "Hors limite"}</ABadge></ASoftTd>
                <ASoftTd className="a-mono">{r.recordedBy.slice(0, 8)}</ASoftTd>
                <ASoftTd className="a-mono text-a-fg-subtle">{new Date(r.recordedAt).toLocaleDateString("fr-TN")}</ASoftTd>
              </ASoftTr>
            )) : null}</tbody>
          </ASoftTable>
         ) : (
          <ASoftTable className="min-w-[40rem]">
            <ASoftThead><tr><ASoftTh>Date</ASoftTh><ASoftTh>Auditeur</ASoftTh><ASoftTh>Statut</ASoftTh></tr></ASoftThead>
            <tbody>{audits.kind === "ok" ? audits.items.map((a) => (
              <ASoftTr key={a.id}>
                <ASoftTd className="a-mono">{new Date(a.auditDate).toLocaleDateString("fr-TN")}</ASoftTd>
                <ASoftTd>{a.auditor}</ASoftTd>
                <ASoftTd><ABadge tone={a.status === "CLOSED" ? "success" : "warning"}>{a.status ?? "OPEN"}</ABadge></ASoftTd>
              </ASoftTr>
            )) : null}</tbody>
          </ASoftTable>
         )}
      </APageBody>
      <ADrawer open={drawerOpen} onOpenChange={setDrawerOpen} title={tab === "ccps" ? "Nouveau CCP" : tab === "records" ? "Nouvel enregistrement" : "Nouvel audit"} description="HACCP" footer={
        <div className="flex flex-wrap justify-end gap-2">
          <AButton variant="secondary" onClick={() => setDrawerOpen(false)}>Annuler</AButton>
          <AButton onClick={() => void onSubmit()} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</AButton>
        </div>
      }>
        <div className="space-y-5 p-4">
          {formError ? <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">{formError}</p> : null}
          {tab === "ccps" ? (
            <AFormSection title="Point critique">
              <AField label="Code"><AInput value={ccpForm.code} onChange={(e) => setCcpForm({ ...ccpForm, code: e.target.value })} /></AField>
              <AField label="Nom"><AInput value={ccpForm.name} onChange={(e) => setCcpForm({ ...ccpForm, name: e.target.value })} /></AField>
              <AField label="Limite critique"><AInput value={ccpForm.criticalLimit} onChange={(e) => setCcpForm({ ...ccpForm, criticalLimit: e.target.value })} /></AField>
              <AField label="Unité"><AInput value={ccpForm.unit} onChange={(e) => setCcpForm({ ...ccpForm, unit: e.target.value })} /></AField>
            </AFormSection>
          ) : tab === "records" ? (
            <AFormSection title="Mesure">
              <AField label="ID CCP"><AInput value={recordForm.ccpId} onChange={(e) => setRecordForm({ ...recordForm, ccpId: e.target.value })} /></AField>
              <AField label="Valeur"><AInput value={recordForm.value} onChange={(e) => setRecordForm({ ...recordForm, value: e.target.value })} /></AField>
              <AField label="Conforme"><ASwitch checked={recordForm.inSpec} onCheckedChange={(v) => setRecordForm({ ...recordForm, inSpec: v })} label="Conforme" /></AField>
              <AField label="Enregistré par"><AInput value={recordForm.recordedBy} onChange={(e) => setRecordForm({ ...recordForm, recordedBy: e.target.value })} /></AField>
              <AField label="Date/heure"><AInput type="datetime-local" value={recordForm.recordedAt} onChange={(e) => setRecordForm({ ...recordForm, recordedAt: e.target.value })} /></AField>
            </AFormSection>
          ) : (
            <AFormSection title="Audit">
              <AField label="Date"><AInput type="date" value={auditForm.auditDate} onChange={(e) => setAuditForm({ ...auditForm, auditDate: e.target.value })} /></AField>
              <AField label="Auditeur"><AInput value={auditForm.auditor} onChange={(e) => setAuditForm({ ...auditForm, auditor: e.target.value })} /></AField>
              <AField label="Statut"><select className={softSelect} value={auditForm.status} onChange={(e) => setAuditForm({ ...auditForm, status: e.target.value })}><option value="">Ouvert</option><option value="CLOSED">Clôturé</option></select></AField>
            </AFormSection>
          )}
        </div>
      </ADrawer>
    </>
  );
}

export default function HaccpPage() {
  return <Suspense fallback={<ASkeleton />}><HaccpWorkspace /></Suspense>;
}
