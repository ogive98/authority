"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
  ASwitch,
} from "@/components/a";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import { HrUpcomingLots } from "@/components/hr/hr-upcoming-lots";
import {
  createBulletin,
  createCnssSnapshot,
  createContract,
  createIrppSnapshot,
  downloadEmployeeDocument,
  endContract,
  fetchBulletinPreview,
  fetchCnssPreview,
  fetchEmployee,
  fetchEmployeeDocuments,
  fetchIrppPreview,
  fetchJobTitles,
  fetchLevyPreview,
  hrEmployeeDocumentContentHref,
  isHrImageMime,
  isHrPreviewableMime,
  patchEmployee,
  uploadEmployeeDocument,
  uploadEmployeePhoto,
  type BulletinPreview,
  type CnssPreview,
  type HrContract,
  type HrEmployee,
  type HrEmployeeDocument,
  type HrJobTitle,
  type IrppPreview,
  type LevyPreview,
} from "@/lib/hr";
import {
  softPageBody,
  softPanel,
  softSelect,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; employee: HrEmployee }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type DrawerMode = "contract" | "cnss" | "irpp" | "bulletin" | "docPreview";

function statusTone(
  status: string,
): "neutral" | "accent" | "success" | "warning" | "danger" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "LEFT":
    case "ENDED":
      return "neutral";
    default:
      return "accent";
  }
}

function dateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function printHrDocument(href: string, mime: string, title: string) {
  if (mime.toLowerCase() === "application/pdf") {
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (!w) return;
    window.setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch {
        /* popup / CORS — user can print from the tab */
      }
    }, 600);
    return;
  }
  const w = window.open("", "_blank");
  if (!w) return;
  const safeTitle = title.replace(/[<>&]/g, "");
  w.document.write(
    `<!doctype html><html><head><title>${safeTitle}</title></head><body style="margin:0"><img src="${href}" alt="" style="max-width:100%;display:block" onload="window.focus();window.print()"/></body></html>`,
  );
  w.document.close();
}

export default function HrEmployeeFichePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";

  const [state, setState] = useState<Load>({ kind: "loading" });
  const [jobTitles, setJobTitles] = useState<HrJobTitle[]>([]);
  const [docs, setDocs] = useState<HrEmployeeDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitleId, setJobTitleId] = useState("");
  const [cnssNo, setCnssNo] = useState("");
  const [email, setEmail] = useState("");
  const [hiredAt, setHiredAt] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [leftAt, setLeftAt] = useState("");
  const [notes, setNotes] = useState("");
  const [taxChef, setTaxChef] = useState(false);
  const [taxEnfantCount, setTaxEnfantCount] = useState("0");
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [previewDoc, setPreviewDoc] = useState<HrEmployeeDocument | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("contract");
  const [contractType, setContractType] = useState("CDI");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState("");
  const [wageRef, setWageRef] = useState("");
  const [wageBase, setWageBase] = useState("");
  const [cnssContract, setCnssContract] = useState<HrContract | null>(null);
  const [cnssPreview, setCnssPreview] = useState<CnssPreview | null>(null);
  const [irppPreview, setIrppPreview] = useState<IrppPreview | null>(null);
  const [bulletinPreview, setBulletinPreview] =
    useState<BulletinPreview | null>(null);
  const [levyPreview, setLevyPreview] = useState<LevyPreview | null>(null);
  const [periodYm, setPeriodYm] = useState(
    new Date().toISOString().slice(0, 7),
  );

  const applyEmployee = useCallback((row: HrEmployee) => {
    setDisplayName(row.displayName);
    setDepartment(row.department ?? "");
    setJobTitleId(row.jobTitleId ?? "");
    setCnssNo(row.cnssNo ?? "");
    setEmail(row.email ?? "");
    setHiredAt(dateInput(row.hiredAt));
    setStatus(row.status);
    setLeftAt(dateInput(row.leftAt));
    setNotes(row.notes ?? "");
    setTaxChef(row.taxChefDeFamille === true);
    setTaxEnfantCount(
      row.taxEnfantCount != null ? String(row.taxEnfantCount) : "0",
    );
  }, []);

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const [res, titles, files] = await Promise.all([
      fetchEmployee(id),
      fetchJobTitles(),
      fetchEmployeeDocuments(id),
    ]);
    if (titles.ok) setJobTitles(titles.data.items);
    if (files.ok) setDocs(files.data.items);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    applyEmployee(res.data);
    setState({ kind: "ok", employee: res.data });
  }, [applyEmployee, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSaveIdentity() {
    if (!id) return;
    setBusy(true);
    setFormError(null);
    const res = await patchEmployee(id, {
      displayName: displayName.trim(),
      department: department.trim() || null,
      jobTitleId: jobTitleId || null,
      cnssNo: cnssNo.trim() || null,
      email: email.trim() || null,
      hiredAt: hiredAt || null,
      status,
      leftAt: status === "LEFT" ? leftAt || null : null,
      notes: notes.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    applyEmployee(res.data);
    setState({ kind: "ok", employee: res.data });
  }

  async function onSaveFiscal() {
    if (!id) return;
    setBusy(true);
    setFormError(null);
    const enfants = Math.max(0, Math.min(20, Number(taxEnfantCount) || 0));
    const res = await patchEmployee(id, {
      taxChefDeFamille: taxChef,
      taxEnfantCount: enfants,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    applyEmployee(res.data);
    setState({ kind: "ok", employee: res.data });
  }

  function openCreateContract() {
    setDrawerMode("contract");
    setFormError(null);
    setContractType("CDI");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
    setWageRef("");
    setWageBase("");
    setDrawerOpen(true);
  }

  async function onCreateContract() {
    if (!id) return;
    setBusy(true);
    setFormError(null);
    const res = await createContract({
      employeeId: id,
      type: contractType,
      startDate,
      endDate: endDate || undefined,
      wageRef: wageRef.trim() || undefined,
      wageBase: wageBase.trim() ? Number(wageBase) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load();
  }

  async function onEndContract(contractId: string) {
    setBusy(true);
    setFormError(null);
    const res = await endContract(contractId);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    await load();
  }

  async function openCnss(contract: HrContract) {
    setDrawerMode("cnss");
    setCnssContract(contract);
    setCnssPreview(null);
    setIrppPreview(null);
    setBulletinPreview(null);
    setLevyPreview(null);
    setFormError(null);
    const ym = new Date().toISOString().slice(0, 7);
    setPeriodYm(ym);
    setDrawerOpen(true);
    setBusy(true);
    const [res, levyRes] = await Promise.all([
      fetchCnssPreview(contract.id, ym),
      fetchLevyPreview(contract.id),
    ]);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setCnssPreview(res.data);
    if (levyRes.ok) setLevyPreview(levyRes.data);
  }

  async function openIrpp(contract: HrContract) {
    setDrawerMode("irpp");
    setCnssContract(contract);
    setCnssPreview(null);
    setIrppPreview(null);
    setBulletinPreview(null);
    setLevyPreview(null);
    setFormError(null);
    const ym = new Date().toISOString().slice(0, 7);
    setPeriodYm(ym);
    setDrawerOpen(true);
    setBusy(true);
    const res = await fetchIrppPreview(contract.id, ym);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setIrppPreview(res.data);
  }

  async function openBulletin(contract: HrContract) {
    setDrawerMode("bulletin");
    setCnssContract(contract);
    setCnssPreview(null);
    setIrppPreview(null);
    setBulletinPreview(null);
    setLevyPreview(null);
    setFormError(null);
    const ym = new Date().toISOString().slice(0, 7);
    setPeriodYm(ym);
    setDrawerOpen(true);
    setBusy(true);
    const res = await fetchBulletinPreview(contract.id, ym);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setBulletinPreview(res.data);
  }

  async function refreshCnssPreview() {
    if (!cnssContract) return;
    setBusy(true);
    setFormError(null);
    const [res, levyRes] = await Promise.all([
      fetchCnssPreview(cnssContract.id, periodYm),
      fetchLevyPreview(cnssContract.id),
    ]);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setCnssPreview(res.data);
    if (levyRes.ok) setLevyPreview(levyRes.data);
  }

  async function refreshIrppPreview() {
    if (!cnssContract) return;
    setBusy(true);
    setFormError(null);
    const res = await fetchIrppPreview(cnssContract.id, periodYm);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setIrppPreview(res.data);
  }

  async function refreshBulletinPreview() {
    if (!cnssContract) return;
    setBusy(true);
    setFormError(null);
    const res = await fetchBulletinPreview(cnssContract.id, periodYm);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setBulletinPreview(res.data);
  }

  async function onSnapshot() {
    if (!cnssContract) return;
    setBusy(true);
    setFormError(null);
    const res = await createCnssSnapshot({
      contractId: cnssContract.id,
      periodYm,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load();
  }

  async function onIrppSnapshot() {
    if (!cnssContract) return;
    setBusy(true);
    setFormError(null);
    const res = await createIrppSnapshot({
      contractId: cnssContract.id,
      periodYm,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load();
  }

  async function onCreateBulletin() {
    if (!cnssContract) return;
    setBusy(true);
    setFormError(null);
    const res = await createBulletin({
      contractId: cnssContract.id,
      periodYm,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    router.push(`/hr/bulletins/${res.data.id}`);
  }

  async function onUploadDoc() {
    if (!id || !docFile) return;
    setBusy(true);
    setFormError(null);
    const res = await uploadEmployeeDocument(
      id,
      docFile,
      docTitle.trim() || undefined,
    );
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDocFile(null);
    setDocTitle("");
    const list = await fetchEmployeeDocuments(id);
    if (list.ok) setDocs(list.data.items);
  }

  async function onUploadPhoto(file: File) {
    if (!id) return;
    setBusy(true);
    setFormError(null);
    const res = await uploadEmployeePhoto(id, file);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    applyEmployee(res.data);
    setState({ kind: "ok", employee: res.data });
    const list = await fetchEmployeeDocuments(id);
    if (list.ok) setDocs(list.data.items);
  }

  async function onClearPhoto() {
    if (!id) return;
    setBusy(true);
    setFormError(null);
    const res = await patchEmployee(id, { photoDocumentId: null });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    applyEmployee(res.data);
    setState({ kind: "ok", employee: res.data });
  }

  async function onUseAsPhoto(doc: HrEmployeeDocument) {
    if (!id) return;
    setBusy(true);
    setFormError(null);
    const res = await patchEmployee(id, { photoDocumentId: doc.id });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    applyEmployee(res.data);
    setState({ kind: "ok", employee: res.data });
  }

  function openPreview(doc: HrEmployeeDocument) {
    setPreviewDoc(doc);
    setDrawerMode("docPreview");
    setDrawerOpen(true);
  }

  const employee = state.kind === "ok" ? state.employee : null;
  const active = employee?.status === "ACTIVE";

  return (
    <>
      <AScreenHeader
        kicker="Ressources humaines"
        title={
          employee
            ? `${employee.displayName}`
            : "Fiche salarié"
        }
        description={
          employee
            ? `Matricule ${employee.matricule} · photo, identité, contrats, fiscal, dossier.`
            : "Photo, identité, contrats, fiscal, dossier."
        }
        actions={
          <Link
            href="/hr"
            className="inline-flex items-center rounded-[var(--a-radius-md)] bg-a-surface-3 px-3 py-1.5 text-[length:var(--a-text-sm)] font-medium text-a-fg hover:opacity-90"
          >
            Retour RH
          </Link>
        }
      />

      <div className={softPageBody}>
        <ExpertiseHintsStrip
          keys={[
            "hr.cnss.employee",
            "hr.cnss.employer",
            "hr.cnss.ceiling",
            "hr.irpp",
            "hr.tfp",
            "hr.foprolos",
          ]}
        />

        {state.kind === "loading" ? <ASkeleton className="h-64 w-full" /> : null}
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

        {formError ? (
          <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
            {formError}
          </p>
        ) : null}

        {employee ? (
          <>
            <section className={softPanel} aria-labelledby="hr-id-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2
                  id="hr-id-title"
                  className="text-[length:var(--a-text-md)] font-semibold text-a-fg"
                >
                  Identité
                </h2>
                <ABadge tone={statusTone(employee.status)}>
                  {employee.status}
                </ABadge>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void onUploadPhoto(file);
                }}
              />
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-a-surface-3 text-[length:var(--a-text-lg)] font-semibold text-a-fg-muted">
                  {employee.photoDocumentId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${hrEmployeeDocumentContentHref(id, employee.photoDocumentId)}?v=${employee.photoDocumentId}`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(employee.displayName)
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <AButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    {employee.photoDocumentId
                      ? "Changer la photo"
                      : "Ajouter une photo"}
                  </AButton>
                  {employee.photoDocumentId ? (
                    <AButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onClearPhoto()}
                    >
                      Retirer
                    </AButton>
                  ) : null}
                </div>
                <p className="w-full text-[length:var(--a-text-xs)] text-a-fg-muted">
                  JPEG, PNG, WebP ou GIF — fichier Documents interne (pas
                  l’avatar Identity).
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Matricule
                  </span>
                  <AInput
                    value={employee.matricule}
                    readOnly
                    className="a-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Nom affiché
                  </span>
                  <AInput
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Poste (catalogue)
                  </span>
                  <select
                    className={softSelect}
                    value={jobTitleId}
                    onChange={(e) => setJobTitleId(e.target.value)}
                  >
                    <option value="">— Aucun —</option>
                    {jobTitles
                      .filter((t) => t.active || t.id === employee.jobTitleId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.code} · {t.name}
                          {t.active ? "" : " (archivé)"}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Département
                  </span>
                  <AInput
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    E-mail
                  </span>
                  <AInput
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    N° affiliation CNSS
                  </span>
                  <AInput
                    value={cnssNo}
                    onChange={(e) => setCnssNo(e.target.value)}
                    placeholder="Identifiant seulement — pas de taux"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Date d’embauche
                  </span>
                  <AInput
                    type="date"
                    value={hiredAt}
                    onChange={(e) => setHiredAt(e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Statut
                  </span>
                  <select
                    className={softSelect}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="LEFT">LEFT</option>
                  </select>
                </label>
                {status === "LEFT" ? (
                  <label className="block space-y-1">
                    <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                      Date de départ
                    </span>
                    <AInput
                      type="date"
                      value={leftAt}
                      onChange={(e) => setLeftAt(e.target.value)}
                    />
                  </label>
                ) : null}
                <label className="block space-y-1 md:col-span-2">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Notes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-md bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg outline-none ring-a-accent focus:ring-2"
                  />
                </label>
              </div>
              <AButton
                type="button"
                disabled={busy || !displayName.trim()}
                onClick={() => void onSaveIdentity()}
              >
                Enregistrer l’identité
              </AButton>
            </section>

            <section className={softPanel} aria-labelledby="hr-tax-title">
              <h2
                id="hr-tax-title"
                className="text-[length:var(--a-text-md)] font-semibold text-a-fg"
              >
                Situation fiscale
              </h2>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Défauts employé — figés dans le snapshot IRPP. Obligatoires si
                Prefs abattements VALIDATED.
              </p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[length:var(--a-text-sm)]">
                  Chef de famille
                </span>
                <ASwitch
                  checked={taxChef}
                  onCheckedChange={setTaxChef}
                  label="Chef de famille"
                />
              </div>
              <label className="block max-w-xs space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Nombre d’enfants à charge
                </span>
                <AInput
                  type="number"
                  min={0}
                  max={20}
                  value={taxEnfantCount}
                  onChange={(e) => setTaxEnfantCount(e.target.value)}
                  className="a-mono"
                />
              </label>
              <AButton
                type="button"
                disabled={busy}
                onClick={() => void onSaveFiscal()}
              >
                Enregistrer le fiscal
              </AButton>
            </section>

            <section className="space-y-3" aria-labelledby="hr-ctr-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2
                  id="hr-ctr-title"
                  className="text-[length:var(--a-text-md)] font-semibold text-a-fg"
                >
                  Contrats
                </h2>
                {active ? (
                  <AButton type="button" onClick={openCreateContract}>
                    Nouveau contrat
                  </AButton>
                ) : null}
              </div>
              {employee.contracts.length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucun contrat.
                </p>
              ) : (
                <div className={softTableWrap}>
                  <table className="w-full min-w-[640px] text-left text-[length:var(--a-text-sm)]">
                    <thead className={softThead}>
                      <tr>
                        <th className="a-table-cell font-medium">N°</th>
                        <th className="a-table-cell font-medium">Type</th>
                        <th className="a-table-cell font-medium">Période</th>
                        <th className="a-table-cell font-medium">Base TND</th>
                        <th className="a-table-cell font-medium">Statut</th>
                        <th className="a-table-cell font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employee.contracts.map((c) => (
                        <tr key={c.id} className={softTr}>
                          <td className="a-mono a-table-cell">{c.number}</td>
                          <td className="a-table-cell">
                            <ABadge tone="accent">{c.type}</ABadge>
                          </td>
                          <td className="a-mono a-table-cell">
                            {c.startDate}
                            {c.endDate ? ` → ${c.endDate}` : ""}
                          </td>
                          <td className="a-mono a-table-cell tabular-nums">
                            {c.wageBase ?? "—"}
                          </td>
                          <td className="a-table-cell">
                            <ABadge tone={statusTone(c.status)}>
                              {c.status}
                            </ABadge>
                          </td>
                          <td className="a-table-cell">
                            {c.status === "ACTIVE" ? (
                              <div className="flex flex-wrap gap-1">
                                <AButton
                                  type="button"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => void openCnss(c)}
                                >
                                  CNSS
                                </AButton>
                                <AButton
                                  type="button"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => void openIrpp(c)}
                                >
                                  IRPP
                                </AButton>
                                <AButton
                                  type="button"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => void openBulletin(c)}
                                >
                                  Bulletin
                                </AButton>
                                <AButton
                                  type="button"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => void onEndContract(c.id)}
                                >
                                  Clôturer
                                </AButton>
                              </div>
                            ) : (
                              <span className="text-a-fg-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={softPanel} aria-labelledby="hr-doc-title">
              <h2
                id="hr-doc-title"
                className="text-[length:var(--a-text-md)] font-semibold text-a-fg"
              >
                Dossier personnel
              </h2>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Documents internes (Documents · HR_EMPLOYEE). Aperçu et
                impression same-origin. Pas de portail client.
              </p>
              {docs.length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucun document.
                </p>
              ) : (
                <div className={softTableWrap}>
                  <table className="w-full min-w-[560px] text-left text-[length:var(--a-text-sm)]">
                    <thead className={softThead}>
                      <tr>
                        <th className="a-table-cell font-medium">Fichier</th>
                        <th className="a-table-cell font-medium">Type</th>
                        <th className="a-table-cell font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((d) => {
                        const href = hrEmployeeDocumentContentHref(id, d.id);
                        const previewable = isHrPreviewableMime(d.mime);
                        const image = isHrImageMime(d.mime);
                        return (
                          <tr key={d.id} className={softTr}>
                            <td className="a-table-cell">
                              <span className="a-mono">{d.number}</span>
                              {" · "}
                              {d.title}
                              {d.id === employee.photoDocumentId ? (
                                <>
                                  {" "}
                                  <ABadge tone="accent">Photo</ABadge>
                                </>
                              ) : null}
                            </td>
                            <td className="a-table-cell text-a-fg-muted">
                              {d.mime || "—"}
                            </td>
                            <td className="a-table-cell">
                              <div className="flex flex-wrap gap-1">
                                <AButton
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={!previewable}
                                  onClick={() => openPreview(d)}
                                >
                                  Aperçu
                                </AButton>
                                <AButton
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    void downloadEmployeeDocument(id, d.id)
                                  }
                                >
                                  Télécharger
                                </AButton>
                                <AButton
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={!previewable}
                                  onClick={() =>
                                    printHrDocument(href, d.mime, d.title)
                                  }
                                >
                                  Imprimer
                                </AButton>
                                {image &&
                                d.id !== employee.photoDocumentId ? (
                                  <AButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => void onUseAsPhoto(d)}
                                  >
                                    Utiliser comme photo
                                  </AButton>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Titre
                </span>
                <AInput
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="CIN, contrat scanné…"
                />
              </label>
              <input
                type="file"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              />
              <AButton
                type="button"
                disabled={busy || !docFile}
                onClick={() => void onUploadDoc()}
              >
                Joindre
              </AButton>
            </section>

            <HrUpcomingLots />
          </>
        ) : null}
      </div>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={
          drawerMode === "contract"
            ? "Nouveau contrat"
            : drawerMode === "irpp"
              ? "IRPP — preview"
              : drawerMode === "bulletin"
                ? "Bulletin — preview"
                : drawerMode === "docPreview"
                  ? previewDoc?.title ?? "Aperçu"
                  : "CNSS — preview"
        }
      >
        <div className="space-y-4 p-1">
          {formError ? (
            <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
              {formError}
            </p>
          ) : null}

          {drawerMode === "contract" ? (
            <>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Type
                </span>
                <select
                  className={softSelect}
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value)}
                >
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="INTERIM">Intérim</option>
                  <option value="STAGE">Stage</option>
                  <option value="OTHER">Autre</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Début
                </span>
                <AInput
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Fin (optionnel)
                </span>
                <AInput
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Réf. salaire (libellé)
                </span>
                <AInput
                  value={wageRef}
                  onChange={(e) => setWageRef(e.target.value)}
                  placeholder="Pas de taux inventé"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Base CNSS TND (saisie humaine)
                </span>
                <AInput
                  value={wageBase}
                  onChange={(e) => setWageBase(e.target.value)}
                  placeholder="ex. 1200.000"
                  className="a-mono"
                />
              </label>
              <AButton
                type="button"
                disabled={busy || !startDate}
                onClick={() => void onCreateContract()}
              >
                Créer le contrat
              </AButton>
            </>
          ) : null}

          {drawerMode === "cnss" ? (
            <>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Contrat {cnssContract?.number} · base{" "}
                <span className="a-mono">{cnssContract?.wageBase ?? "—"}</span>{" "}
                TND
              </p>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Période (YYYY-MM)
                </span>
                <AInput
                  value={periodYm}
                  onChange={(e) => setPeriodYm(e.target.value)}
                  className="a-mono"
                />
              </label>
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void refreshCnssPreview()}
              >
                Recalculer
              </AButton>
              {cnssPreview ? (
                <div className="a-underlay space-y-2 rounded-md p-3 text-[length:var(--a-text-sm)]">
                  <p>
                    Assiette{" "}
                    <span className="a-mono tabular-nums">
                      {cnssPreview.assiette.toFixed(3)}
                    </span>
                    {cnssPreview.ceilingApplied ? " · plafond appliqué" : ""}
                  </p>
                  <p>
                    Salarié{" "}
                    <span className="a-mono tabular-nums">
                      {cnssPreview.employeeAmount != null
                        ? cnssPreview.employeeAmount.toFixed(3)
                        : "—"}
                    </span>
                  </p>
                  <p>
                    Employeur{" "}
                    <span className="a-mono tabular-nums">
                      {cnssPreview.employerAmount != null
                        ? cnssPreview.employerAmount.toFixed(3)
                        : "—"}
                    </span>
                  </p>
                  {!cnssPreview.ready ? (
                    <p className="text-a-warning">
                      Expertise requise : {cnssPreview.pending.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {levyPreview ? (
                <div className="a-underlay space-y-2 rounded-md p-3 text-[length:var(--a-text-sm)]">
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Taxes employeur (Prefs) — hors net bulletin
                  </p>
                  <p>
                    TFP{" "}
                    <span className="a-mono tabular-nums">
                      {levyPreview.tfp.amount != null
                        ? levyPreview.tfp.amount.toFixed(3)
                        : "—"}
                    </span>{" "}
                    TND
                  </p>
                  <p>
                    FOPROLOS{" "}
                    <span className="a-mono tabular-nums">
                      {levyPreview.foprolos.amount != null
                        ? levyPreview.foprolos.amount.toFixed(3)
                        : "—"}
                    </span>{" "}
                    TND
                  </p>
                  {!levyPreview.ready ? (
                    <p className="text-a-warning">
                      Expertise requise : {levyPreview.pending.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <AButton
                type="button"
                disabled={busy || !cnssPreview?.ready}
                onClick={() => void onSnapshot()}
              >
                Enregistrer snapshot
              </AButton>
            </>
          ) : null}

          {drawerMode === "irpp" ? (
            <>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Assiette = wageBase − CNSS − abattements annuels Prefs (si
                VALIDATED) · barème / 12. Aucun seuil inventé.
              </p>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Période (YYYY-MM)
                </span>
                <AInput
                  value={periodYm}
                  onChange={(e) => setPeriodYm(e.target.value)}
                  className="a-mono"
                />
              </label>
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void refreshIrppPreview()}
              >
                Recalculer
              </AButton>
              {irppPreview ? (
                <div className="a-underlay space-y-2 rounded-md p-3 text-[length:var(--a-text-sm)]">
                  <p>
                    IRPP mensuel{" "}
                    <span className="a-mono tabular-nums">
                      {irppPreview.monthlyIrpp != null
                        ? irppPreview.monthlyIrpp.toFixed(3)
                        : "—"}
                    </span>
                  </p>
                  {!irppPreview.ready ? (
                    <p className="text-a-warning">
                      Expertise requise : {irppPreview.pending.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <AButton
                type="button"
                disabled={busy || !irppPreview?.ready}
                onClick={() => void onIrppSnapshot()}
              >
                Enregistrer snapshot
              </AButton>
            </>
          ) : null}

          {drawerMode === "docPreview" && previewDoc ? (
            <>
              {isHrImageMime(previewDoc.mime) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hrEmployeeDocumentContentHref(id, previewDoc.id)}
                  alt={previewDoc.title}
                  className="max-h-[70vh] w-full rounded-md object-contain"
                />
              ) : previewDoc.mime.toLowerCase() === "application/pdf" ? (
                <iframe
                  title={previewDoc.title}
                  src={hrEmployeeDocumentContentHref(id, previewDoc.id)}
                  className="h-[70vh] w-full rounded-md bg-a-surface-3"
                />
              ) : (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aperçu indisponible pour ce type. Téléchargez le fichier.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <AButton
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    void downloadEmployeeDocument(id, previewDoc.id)
                  }
                >
                  Télécharger
                </AButton>
                <AButton
                  type="button"
                  disabled={!isHrPreviewableMime(previewDoc.mime)}
                  onClick={() =>
                    printHrDocument(
                      hrEmployeeDocumentContentHref(id, previewDoc.id),
                      previewDoc.mime,
                      previewDoc.title,
                    )
                  }
                >
                  Imprimer
                </AButton>
              </div>
            </>
          ) : null}

          {drawerMode === "bulletin" ? (
            <>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Net = wageBase − CNSS salarié − IRPP mensuel. TFP/FOPROLOS hors
                net.
              </p>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Période (YYYY-MM)
                </span>
                <AInput
                  value={periodYm}
                  onChange={(e) => setPeriodYm(e.target.value)}
                  className="a-mono"
                />
              </label>
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void refreshBulletinPreview()}
              >
                Recalculer
              </AButton>
              {bulletinPreview ? (
                <div className="a-underlay space-y-2 rounded-md p-3 text-[length:var(--a-text-sm)]">
                  <p>
                    Net{" "}
                    <span className="a-mono tabular-nums font-medium">
                      {bulletinPreview.netPay?.toFixed(3) ?? "—"}
                    </span>{" "}
                    {bulletinPreview.currency}
                  </p>
                  {!bulletinPreview.ready ? (
                    <p className="text-a-warning">
                      Snapshots requis : {bulletinPreview.pending.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <AButton
                type="button"
                disabled={busy || !bulletinPreview?.ready}
                onClick={() => void onCreateBulletin()}
              >
                Enregistrer & imprimer
              </AButton>
            </>
          ) : null}
        </div>
      </ADrawer>
    </>
  );
}
