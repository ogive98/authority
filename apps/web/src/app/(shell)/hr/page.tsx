"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  CalendarDays,
  FileStack,
  FileText,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import { HrCongesPanel } from "@/components/hr/hr-conges-panel";
import { hrTabHref, parseHrTab, hrEmployeeHref, type HrTab } from "@/lib/hr-tabs";
import { localizeUiString } from "@/lib/i18n/route-labels";
import { useLocaleStore } from "@/stores/locale-store";
import { cn } from "@/lib/utils";
import {
  createDocKind,
  createEmployee,
  createJobTitle,
  createPrintTemplate,
  downloadBulletinPdf,
  fetchAttestationPrintTemplate,
  fetchBulletins,
  fetchContractPrintTemplate,
  fetchDocKinds,
  fetchEmployees,
  fetchJobTitles,
  fetchPrintTemplates,
  hrEmployeeDocumentContentHref,
  patchDocKind,
  patchJobTitle,
  putAttestationPrintTemplate,
  putContractPrintTemplate,
  type Bulletin,
  type HrAttestationPrintTemplate,
  type HrContractPrintTemplate,
  type HrDocKind,
  type HrEmployee,
  type HrJobTitle,
  type HrPrintDocKind,
  type HrPrintTemplate,
} from "@/lib/hr";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import {
  softPageBody,
  softPanel,
  softSelect,
  softTableWrap,
  softThead,
  softTr,
  softUnderlineTabClass,
} from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: HrEmployee[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type DrawerMode = "employee" | "jobTitle" | "docKind";

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function HrEmployeesPage() {
  return (
    <Suspense fallback={<ASkeleton className="h-48 w-full" />}>
      <HrWorkspace />
    </Suspense>
  );
}

function HrWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocaleStore((s) => s.locale);
  const [tab, setTab] = useState<HrTab>(() =>
    parseHrTab(searchParams.toString()),
  );
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("employee");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [matricule, setMatricule] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitleId, setJobTitleId] = useState("");
  const [jobTitles, setJobTitles] = useState<HrJobTitle[]>([]);
  const [jobCode, setJobCode] = useState("");
  const [jobName, setJobName] = useState("");
  const [docKinds, setDocKinds] = useState<HrDocKind[]>([]);
  const [kindCode, setKindCode] = useState("");
  const [kindName, setKindName] = useState("");
  const [printTpl, setPrintTpl] = useState<HrContractPrintTemplate>({
    letterhead: "",
    bodyHtml: "",
    footer: "",
  });
  const [attestTpl, setAttestTpl] = useState<HrAttestationPrintTemplate>({
    letterhead: "",
    bodyHtml: "",
    footer: "",
  });
  const [catalogue, setCatalogue] = useState<HrPrintTemplate[]>([]);
  const [catKind, setCatKind] = useState<HrPrintDocKind>("CONTRACT");
  const [catCode, setCatCode] = useState("");
  const [catName, setCatName] = useState("");
  const [cnssNo, setCnssNo] = useState("");
  const [cinNo, setCinNo] = useState("");
  const [address, setAddress] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [hiredAt, setHiredAt] = useState("");
  const [email, setEmail] = useState("");
  const [provisionLogin, setProvisionLogin] = useState(true);
  const [provisionReveal, setProvisionReveal] = useState<{
    email: string;
    password: string;
    emailSent: boolean;
    smtpConfigured: boolean;
    employeeId: string;
  } | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const [res, bul, titles, kinds, tpl, att, cats] = await Promise.all([
      fetchEmployees(query),
      fetchBulletins({ limit: 30 }),
      fetchJobTitles(),
      fetchDocKinds(),
      fetchContractPrintTemplate(),
      fetchAttestationPrintTemplate(),
      fetchPrintTemplates(),
    ]);
    if (titles.ok) setJobTitles(titles.data.items);
    if (kinds.ok) setDocKinds(kinds.data.items);
    if (tpl.ok) setPrintTpl(tpl.data);
    if (att.ok) setAttestTpl(att.data);
    if (cats.ok) setCatalogue(cats.data.items);
    if (bul.ok) setBulletins(bul.data.items);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({ kind: "ok", items: res.data.items });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function apply() {
      const next = parseHrTab(
        searchParams.toString(),
        window.location.hash,
      );
      setTab(next);
    }
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [searchParams]);

  function goTab(next: HrTab) {
    setTab(next);
    setDrawerOpen(false);
    router.replace(hrTabHref(next), { scroll: false });
  }

  function openCreateEmployee() {
    setDrawerMode("employee");
    setFormError(null);
    setMatricule("");
    setDisplayName("");
    setDepartment("");
    setJobTitleId("");
    setCnssNo("");
    setCinNo("");
    setAddress("");
    setBankName("");
    setBankAgency("");
    setBankAccount("");
    setHiredAt("");
    setEmail("");
    setProvisionLogin(true);
    setProvisionReveal(null);
    setDrawerOpen(true);
  }

  function openCreateJobTitle() {
    setDrawerMode("jobTitle");
    setFormError(null);
    setJobCode("");
    setJobName("");
    setDrawerOpen(true);
  }

  function openCreateDocKind() {
    setDrawerMode("docKind");
    setFormError(null);
    setKindCode("");
    setKindName("");
    setDrawerOpen(true);
  }

  async function onDownloadPdf(id: string) {
    setPdfBusyId(id);
    setFormError(null);
    const res = await downloadBulletinPdf(id);
    setPdfBusyId(null);
    if (!res.ok) {
      setFormError(res.message);
    }
  }

  async function onCreateEmployee() {
    setBusy(true);
    setFormError(null);
    if (provisionLogin && !email.trim()) {
      setBusy(false);
      setFormError("E-mail requis pour créer le login Identity.");
      return;
    }
    const res = await createEmployee({
      matricule: matricule.trim(),
      displayName: displayName.trim(),
      department: department.trim() || undefined,
      jobTitleId: jobTitleId || undefined,
      cnssNo: cnssNo.trim() || undefined,
      cinNo: cinNo.trim() || undefined,
      address: address.trim() || undefined,
      bankName: bankName.trim() || undefined,
      bankAgency: bankAgency.trim() || undefined,
      bankAccount: bankAccount.trim() || undefined,
      hiredAt: hiredAt || undefined,
      email: email.trim() || undefined,
      provisionLogin: provisionLogin || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    if (res.data.provisionalPassword && res.data.provision) {
      setProvisionReveal({
        email: res.data.provision.email,
        password: res.data.provisionalPassword,
        emailSent: res.data.provision.emailSent,
        smtpConfigured: res.data.provision.smtpConfigured,
        employeeId: res.data.id,
      });
      return;
    }
    router.push(hrEmployeeHref(res.data.id));
  }

  async function onCreateJobTitle() {
    setBusy(true);
    setFormError(null);
    const res = await createJobTitle({
      code: jobCode.trim(),
      name: jobName.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    goTab("postes");
    await load(q);
  }

  async function onArchiveJobTitle(id: string, active: boolean) {
    setBusy(true);
    const res = await patchJobTitle(id, { active });
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  async function onCreateDocKind() {
    setBusy(true);
    setFormError(null);
    const res = await createDocKind({
      code: kindCode.trim(),
      name: kindName.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    goTab("kinds");
    await load(q);
  }

  async function onArchiveDocKind(id: string, active: boolean) {
    setBusy(true);
    const res = await patchDocKind(id, { active });
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  async function onSavePrintTemplate() {
    setBusy(true);
    setFormError(null);
    const res = await putContractPrintTemplate(printTpl);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setPrintTpl(res.data);
  }

  async function onSaveAttestTemplate() {
    setBusy(true);
    setFormError(null);
    const res = await putAttestationPrintTemplate(attestTpl);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setAttestTpl(res.data);
  }

  async function onCreateCatalogueTemplate() {
    setBusy(true);
    setFormError(null);
    const res = await createPrintTemplate({
      kind: catKind,
      code: catCode.trim(),
      name: catName.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setCatCode("");
    setCatName("");
    const cats = await fetchPrintTemplates();
    if (cats.ok) setCatalogue(cats.data.items);
  }

  return (
    <>
      <AScreenHeader
        kicker="Ressources humaines"
        title={
          tab === "postes"
            ? "Postes"
            : tab === "kinds"
              ? "Kinds documents"
              : tab === "templates"
                ? "Templates impression"
                : tab === "bulletins"
                  ? "Bulletins"
                  : tab === "conges"
                    ? "Congés"
                    : "Employés"
        }
        description={
          tab === "postes"
            ? "Catalogue société — code + libellé, vide jusqu’à saisie. Pas de texte libre sur l’employé."
            : tab === "kinds"
              ? "Catalogue dossier (CIN, contrat…) — vide jusqu’à saisie. Jamais seedé."
              : tab === "templates"
                ? "Squelettes Prefs (A) + catalogue société (B). Aucune clause légale inventée."
                : tab === "bulletins"
                  ? "Bulletins persistés (CNSS + IRPP). Création depuis la fiche salarié."
                  : tab === "conges"
                    ? "Demandes d’absence — approbation seulement. Pas de quotas inventés."
                    : "Liste des salariés. Ouvrir la fiche pour contrats, fiscal, dossier."
        }
        actions={
          tab === "postes" ? (
            <AButton type="button" onClick={openCreateJobTitle}>
              Nouveau poste
            </AButton>
          ) : tab === "kinds" ? (
            <AButton type="button" onClick={openCreateDocKind}>
              Nouveau kind
            </AButton>
          ) : tab === "templates" ? undefined : tab === "employees" ? (
            <AButton type="button" onClick={openCreateEmployee}>
              Nouvel employé
            </AButton>
          ) : undefined
        }
      />

      <div className={softPageBody}>
        {tab !== "postes" &&
        tab !== "kinds" &&
        tab !== "templates" &&
        tab !== "conges" ? (
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
        ) : null}

        <div className="flex flex-wrap gap-5">
          {(
            [
              ["employees", "Employés", Users],
              ["postes", "Postes", Briefcase],
              ["kinds", "Kinds", FileStack],
              ["templates", "Templates", ScrollText],
              ["bulletins", "Bulletins", FileText],
              ["conges", "Congés", CalendarDays],
            ] as const satisfies ReadonlyArray<
              readonly [HrTab, string, LucideIcon]
            >
          ).map(([id, label, Icon]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                className={softUnderlineTabClass(active)}
                onClick={() => goTab(id)}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-a-fg" : "text-a-fg-muted",
                  )}
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span>{localizeUiString(label, locale) ?? label}</span>
              </button>
            );
          })}
        </div>

        {formError ? (
          <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
            {formError}
          </p>
        ) : null}

        {state.kind === "loading" ? <ASkeleton className="h-48 w-full" /> : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load(q)}
          />
        ) : null}

        {tab === "employees" && state.kind === "ok" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <AInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Matricule, nom, CNSS…"
                className="max-w-xs"
              />
              <AButton type="button" variant="ghost" onClick={() => void load(q)}>
                Filtrer
              </AButton>
            </div>

            {state.items.length === 0 ? (
              <AEmptyState
                title="Aucun employé"
                description="Créez un employé pour ouvrir la fiche RH."
                actionLabel="Nouvel employé"
                onAction={openCreateEmployee}
              />
            ) : (
              <div className={softTableWrap}>
                <table className="w-full min-w-[640px] text-left text-[length:var(--a-text-sm)]">
                  <thead className={softThead}>
                    <tr>
                      <th className="a-table-cell font-medium">Matricule</th>
                      <th className="a-table-cell font-medium">Nom</th>
                      <th className="a-table-cell font-medium">Poste</th>
                      <th className="a-table-cell font-medium">CNSS n°</th>
                      <th className="a-table-cell font-medium">Statut</th>
                      <th className="a-table-cell font-medium">Contrats</th>
                      <th className="a-table-cell font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.items.map((row) => {
                      const active = row.contracts.filter(
                        (c) => c.status === "ACTIVE",
                      );
                      return (
                        <tr key={row.id} className={softTr}>
                          <td className="a-table-cell">
                            <Link
                              href={hrEmployeeHref(row.id)}
                              className="a-mono font-medium text-a-accent hover:underline"
                            >
                              {row.matricule}
                            </Link>
                          </td>
                          <td className="a-table-cell">
                            <span className="inline-flex items-center gap-2">
                              {row.photoDocumentId ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={`${hrEmployeeDocumentContentHref(row.id, row.photoDocumentId)}?v=${row.photoDocumentId}`}
                                  alt=""
                                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                                />
                              ) : (
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-a-surface-3 text-[length:var(--a-text-xs)] font-medium text-a-fg-muted">
                                  {initials(row.displayName)}
                                </span>
                              )}
                              {row.displayName}
                            </span>
                          </td>
                          <td className="a-table-cell text-a-fg-muted">
                            {[row.jobTitle, row.department]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </td>
                          <td className="a-mono a-table-cell">
                            {row.cnssNo ?? "—"}
                          </td>
                          <td className="a-table-cell">
                            <ABadge tone={statusTone(row.status)}>
                              {row.status}
                            </ABadge>
                          </td>
                          <td className="a-table-cell">
                            {active.length === 0 ? (
                              <span className="text-a-fg-muted">—</span>
                            ) : (
                              <span className="a-mono text-[length:var(--a-text-xs)]">
                                {active.map((c) => c.number).join(" · ")}
                              </span>
                            )}
                          </td>
                          <td className="a-table-cell">
                            <Link
                              href={hrEmployeeHref(row.id)}
                              className="text-[length:var(--a-text-sm)] font-medium text-a-accent hover:underline"
                            >
                              Fiche
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}

        {tab === "postes" && state.kind === "ok" ? (
          jobTitles.length === 0 ? (
            <AEmptyState
              title="Aucun poste"
              description="Catalogue société vide jusqu’à saisie humaine — pas de texte libre sur l’employé."
              actionLabel="Nouveau poste"
              onAction={openCreateJobTitle}
            />
          ) : (
            <div className={softTableWrap}>
              <table className="w-full min-w-[480px] text-left text-[length:var(--a-text-sm)]">
                <thead className={softThead}>
                  <tr>
                    <th className="a-table-cell font-medium">Code</th>
                    <th className="a-table-cell font-medium">Libellé</th>
                    <th className="a-table-cell font-medium">Statut</th>
                    <th className="a-table-cell font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobTitles.map((t) => (
                    <tr key={t.id} className={softTr}>
                      <td className="a-mono a-table-cell">{t.code}</td>
                      <td className="a-table-cell">{t.name}</td>
                      <td className="a-table-cell">
                        <ABadge tone={t.active ? "success" : "neutral"}>
                          {t.active ? "ACTIF" : "ARCHIVÉ"}
                        </ABadge>
                      </td>
                      <td className="a-table-cell">
                        <AButton
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void onArchiveJobTitle(t.id, !t.active)}
                        >
                          {t.active ? "Archiver" : "Réactiver"}
                        </AButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === "kinds" && state.kind === "ok" ? (
          docKinds.length === 0 ? (
            <AEmptyState
              title="Aucun kind"
              description="Catalogue dossier vide — saisissez CIN / contrat scanné si besoin. Jamais seedé."
              actionLabel="Nouveau kind"
              onAction={openCreateDocKind}
            />
          ) : (
            <div className={softTableWrap}>
              <table className="w-full min-w-[480px] text-left text-[length:var(--a-text-sm)]">
                <thead className={softThead}>
                  <tr>
                    <th className="a-table-cell font-medium">Code</th>
                    <th className="a-table-cell font-medium">Libellé</th>
                    <th className="a-table-cell font-medium">Statut</th>
                    <th className="a-table-cell font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docKinds.map((k) => (
                    <tr key={k.id} className={softTr}>
                      <td className="a-mono a-table-cell">{k.code}</td>
                      <td className="a-table-cell">{k.name}</td>
                      <td className="a-table-cell">
                        <ABadge tone={k.active ? "success" : "neutral"}>
                          {k.active ? "ACTIF" : "ARCHIVÉ"}
                        </ABadge>
                      </td>
                      <td className="a-table-cell">
                        <AButton
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void onArchiveDocKind(k.id, !k.active)}
                        >
                          {k.active ? "Archiver" : "Réactiver"}
                        </AButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === "templates" && state.kind === "ok" ? (
          <div className="space-y-6">
            <section className={softPanel} aria-labelledby="hr-tpl-title">
              <h2
                id="hr-tpl-title"
                className="text-[length:var(--a-text-md)] font-semibold text-a-fg"
              >
                Prefs contrat (squelette A)
              </h2>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Placeholders :{" "}
                <span className="a-mono text-[length:var(--a-text-xs)]">
                  {
                    "{{employeeName}} {{matricule}} {{cinNo}} {{cnssNo}} {{address}} {{bankName}} {{bankAgency}} {{bankAccount}} {{contractNumber}} {{contractType}} {{startDate}} {{endDate}} {{wageRef}} {{wageBase}} {{companyName}}"
                  }
                </span>
                . Défaut = squelette structurel — aucune clause légale inventée.
              </p>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  En-tête
                </span>
                <textarea
                  value={printTpl.letterhead}
                  onChange={(e) =>
                    setPrintTpl((t) => ({ ...t, letterhead: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-md bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg outline-none ring-a-accent focus:ring-2"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Corps (HTML)
                </span>
                <textarea
                  value={printTpl.bodyHtml}
                  onChange={(e) =>
                    setPrintTpl((t) => ({ ...t, bodyHtml: e.target.value }))
                  }
                  rows={6}
                  className="w-full rounded-md bg-a-surface-3 px-3 py-2 font-mono text-[length:var(--a-text-xs)] text-a-fg outline-none ring-a-accent focus:ring-2"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Pied
                </span>
                <textarea
                  value={printTpl.footer}
                  onChange={(e) =>
                    setPrintTpl((t) => ({ ...t, footer: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-md bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg outline-none ring-a-accent focus:ring-2"
                />
              </label>
              <AButton
                type="button"
                disabled={busy}
                onClick={() => void onSavePrintTemplate()}
              >
                Enregistrer Prefs contrat
              </AButton>
            </section>

            <section className={softPanel} aria-labelledby="hr-att-tpl-title">
              <h2
                id="hr-att-tpl-title"
                className="text-[length:var(--a-text-md)] font-semibold text-a-fg"
              >
                Prefs attestation (squelette A)
              </h2>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Placeholders :{" "}
                <span className="a-mono text-[length:var(--a-text-xs)]">
                  {
                    "{{employeeName}} {{matricule}} {{cinNo}} {{cnssNo}} {{address}} {{jobTitle}} {{department}} {{contractNumber}} {{contractType}} {{startDate}} {{hiredAt}} {{companyName}}"
                  }
                </span>
              </p>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  En-tête
                </span>
                <textarea
                  value={attestTpl.letterhead}
                  onChange={(e) =>
                    setAttestTpl((t) => ({ ...t, letterhead: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-md bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg outline-none ring-a-accent focus:ring-2"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Corps (HTML)
                </span>
                <textarea
                  value={attestTpl.bodyHtml}
                  onChange={(e) =>
                    setAttestTpl((t) => ({ ...t, bodyHtml: e.target.value }))
                  }
                  rows={6}
                  className="w-full rounded-md bg-a-surface-3 px-3 py-2 font-mono text-[length:var(--a-text-xs)] text-a-fg outline-none ring-a-accent focus:ring-2"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Pied
                </span>
                <textarea
                  value={attestTpl.footer}
                  onChange={(e) =>
                    setAttestTpl((t) => ({ ...t, footer: e.target.value }))
                  }
                  rows={2}
                  className="w-full rounded-md bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg outline-none ring-a-accent focus:ring-2"
                />
              </label>
              <AButton
                type="button"
                disabled={busy}
                onClick={() => void onSaveAttestTemplate()}
              >
                Enregistrer Prefs attestation
              </AButton>
            </section>

            <section className={softPanel} aria-labelledby="hr-cat-tpl-title">
              <h2
                id="hr-cat-tpl-title"
                className="text-[length:var(--a-text-md)] font-semibold text-a-fg"
              >
                Catalogue société (B)
              </h2>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Templates nommés — vides jusqu’à saisie. Sélectionnables sur la
                fiche à la génération PDF.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Kind
                  </span>
                  <select
                    className={softSelect}
                    value={catKind}
                    onChange={(e) =>
                      setCatKind(e.target.value as HrPrintDocKind)
                    }
                  >
                    <option value="CONTRACT">CONTRACT</option>
                    <option value="ATTESTATION">ATTESTATION</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Code
                  </span>
                  <AInput
                    value={catCode}
                    onChange={(e) => setCatCode(e.target.value)}
                    className="a-mono"
                    placeholder="STD"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Libellé
                  </span>
                  <AInput
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="Contrat standard"
                  />
                </label>
              </div>
              <AButton
                type="button"
                disabled={busy || !catCode.trim() || !catName.trim()}
                onClick={() => void onCreateCatalogueTemplate()}
              >
                Ajouter au catalogue
              </AButton>
              {catalogue.length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Catalogue vide.
                </p>
              ) : (
                <div className={softTableWrap}>
                  <table className="w-full min-w-[480px] text-left text-[length:var(--a-text-sm)]">
                    <thead className={softThead}>
                      <tr>
                        <th className="a-table-cell font-medium">Kind</th>
                        <th className="a-table-cell font-medium">Code</th>
                        <th className="a-table-cell font-medium">Libellé</th>
                        <th className="a-table-cell font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalogue.map((t) => (
                        <tr key={t.id} className={softTr}>
                          <td className="a-table-cell">
                            <ABadge tone="accent">{t.kind}</ABadge>
                          </td>
                          <td className="a-mono a-table-cell">{t.code}</td>
                          <td className="a-table-cell">{t.name}</td>
                          <td className="a-table-cell">
                            <ABadge tone={t.active ? "success" : "neutral"}>
                              {t.active ? "ACTIF" : "ARCHIVÉ"}
                            </ABadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ) : null}

        {tab === "bulletins" && state.kind === "ok" ? (
          bulletins.length === 0 ? (
            <AEmptyState
              title="Aucun bulletin"
              description="Générez un bulletin depuis un contrat actif (fiche salarié)."
              actionLabel="Aller aux employés"
              onAction={() => goTab("employees")}
            />
          ) : (
            <div className={softTableWrap}>
              <table className="w-full min-w-[640px] text-left text-[length:var(--a-text-sm)]">
                <thead className={softThead}>
                  <tr>
                    <th className="a-table-cell font-medium">N°</th>
                    <th className="a-table-cell font-medium">Période</th>
                    <th className="a-table-cell font-medium">Employé</th>
                    <th className="a-table-cell font-medium">Net</th>
                    <th className="a-table-cell font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bulletins.map((b) => (
                    <tr key={b.id} className={softTr}>
                      <td className="a-mono a-table-cell">{b.number}</td>
                      <td className="a-mono a-table-cell">{b.periodYm}</td>
                      <td className="a-table-cell">
                        {b.matricule ? `${b.matricule} · ` : ""}
                        {b.employeeName ?? "—"}
                      </td>
                      <td className="a-mono a-table-cell tabular-nums">
                        {b.netPay} {b.currency}
                      </td>
                      <td className="a-table-cell">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/hr/bulletins/${b.id}`}
                            className="text-[length:var(--a-text-sm)] font-medium text-a-accent hover:underline"
                          >
                            Imprimer
                          </Link>
                          <button
                            type="button"
                            className="text-[length:var(--a-text-sm)] font-medium text-a-accent hover:underline disabled:opacity-50"
                            disabled={pdfBusyId === b.id}
                            onClick={() => void onDownloadPdf(b.id)}
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === "conges" ? <HrCongesPanel /> : null}
      </div>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={
          drawerMode === "jobTitle"
            ? "Nouveau poste"
            : drawerMode === "docKind"
              ? "Nouveau kind"
              : "Nouvel employé"
        }
      >
        <div className="space-y-4 p-1">
          {formError ? (
            <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
              {formError}
            </p>
          ) : null}

          {drawerMode === "employee" ? (
            <>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Matricule
                </span>
                <AInput
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value)}
                  placeholder="E-001"
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
                  Département
                </span>
                <AInput
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
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
                    .filter((t) => t.active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} · {t.name}
                      </option>
                    ))}
                </select>
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
                  CIN (8 chiffres)
                </span>
                <AInput
                  value={cinNo}
                  onChange={(e) => setCinNo(e.target.value)}
                  placeholder="12345678"
                  className="a-mono"
                  maxLength={8}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Adresse
                </span>
                <AInput
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Banque
                </span>
                <AInput
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Agence
                </span>
                <AInput
                  value={bankAgency}
                  onChange={(e) => setBankAgency(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  N° compte / RIB
                </span>
                <AInput
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="a-mono"
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
                  E-mail (Identity / portail)
                </span>
                <AInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="salarie@entreprise.tn"
                  autoComplete="off"
                />
              </label>
              <label className="flex items-start gap-2 rounded-[var(--a-radius-sm)] bg-a-surface-2/60 px-3 py-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={provisionLogin}
                  onChange={(e) => setProvisionLogin(e.target.checked)}
                />
                <span className="text-[length:var(--a-text-sm)] text-a-fg">
                  Créer login Identity (rôle salarié) + mot de passe provisoire
                  affiché une fois · e-mail Soft Glass si SMTP configuré
                </span>
              </label>
              <AButton
                type="button"
                disabled={
                  busy ||
                  !matricule.trim() ||
                  !displayName.trim() ||
                  (provisionLogin && !email.trim())
                }
                onClick={() => void onCreateEmployee()}
              >
                Créer
              </AButton>
            </>
          ) : null}

          {drawerMode === "jobTitle" ? (
            <>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Catalogue société — vide jusqu’à saisie. Pas de libellés
                seedés.
              </p>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Code
                </span>
                <AInput
                  value={jobCode}
                  onChange={(e) => setJobCode(e.target.value)}
                  placeholder="OPE"
                  className="a-mono"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Libellé
                </span>
                <AInput
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="Opérateur"
                />
              </label>
              <AButton
                type="button"
                disabled={busy || !jobCode.trim() || !jobName.trim()}
                onClick={() => void onCreateJobTitle()}
              >
                Créer le poste
              </AButton>
            </>
          ) : null}

          {drawerMode === "docKind" ? (
            <>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Catalogue dossier — CIN / contrat uniquement si vous les
                saisissez. Jamais seedé.
              </p>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Code
                </span>
                <AInput
                  value={kindCode}
                  onChange={(e) => setKindCode(e.target.value)}
                  placeholder="CIN"
                  className="a-mono"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Libellé
                </span>
                <AInput
                  value={kindName}
                  onChange={(e) => setKindName(e.target.value)}
                  placeholder="Carte d’identité"
                />
              </label>
              <AButton
                type="button"
                disabled={busy || !kindCode.trim() || !kindName.trim()}
                onClick={() => void onCreateDocKind()}
              >
                Créer le kind
              </AButton>
            </>
          ) : null}
        </div>
      </ADrawer>

      {provisionReveal ? (
        <div
          className="fixed inset-0 z-[var(--a-z-modal)] flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="provision-title"
        >
          <div className="a-underlay w-full max-w-md space-y-4 rounded-[14px] bg-a-surface-2 p-[var(--a-space-5)]">
            <h2
              id="provision-title"
              className="text-[length:var(--a-text-lg)] font-semibold text-a-fg"
            >
              Login provisoire (une seule fois)
            </h2>
            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Copiez maintenant — le mot de passe ne sera plus réaffiché.
              Portail :{" "}
              <span className="a-mono text-a-fg">/employee-portal/login</span>
            </p>
            <div className="space-y-2 rounded-[var(--a-radius-sm)] bg-a-surface-3/50 px-3 py-2">
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                E-mail
              </p>
              <p className="a-mono text-[length:var(--a-text-sm)] text-a-fg">
                {provisionReveal.email}
              </p>
              <p className="mt-2 text-[length:var(--a-text-xs)] text-a-fg-muted">
                Mot de passe provisoire
              </p>
              <p className="a-mono text-[length:var(--a-text-sm)] text-a-fg">
                {provisionReveal.password}
              </p>
            </div>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
              {provisionReveal.emailSent
                ? "E-mail Soft Glass envoyé (SMTP)."
                : provisionReveal.smtpConfigured
                  ? "SMTP OK mais envoi auto désactivé — remettez le MDP à la main."
                  : "SMTP non configuré — remettez le MDP à la main (Préférences → Envois)."}
            </p>
            <div className="flex flex-wrap gap-2">
              <AButton
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(
                    `${provisionReveal.email}\n${provisionReveal.password}`,
                  );
                }}
              >
                Copier
              </AButton>
              <AButton
                type="button"
                variant="ghost"
                onClick={() => {
                  const id = provisionReveal.employeeId;
                  setProvisionReveal(null);
                  router.push(hrEmployeeHref(id));
                }}
              >
                Ouvrir la fiche
              </AButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
