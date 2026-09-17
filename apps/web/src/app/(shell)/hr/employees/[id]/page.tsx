"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ABadge,
  AButton,
  AContextPanel,
  ADetailGrid,
  ADrawer,
  AErrorState,
  AForbiddenState,
  AInput,
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
  ASwitch,
  type AOverflowItem,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import { HrUpcomingLots } from "@/components/hr/hr-upcoming-lots";
import { AttendanceCalendarPanel } from "@/components/attendance/attendance-calendar-panel";
import { ribFieldHint } from "@/lib/rib-tn";
import {
  fetchBusinessContext,
  listCompanySites,
} from "@/lib/business-auth";
import {
  createBulletin,
  createCnssSnapshot,
  createContract,
  createIrppSnapshot,
  downloadAttestationPdf,
  downloadContractPdf,
  downloadEmployeeDocument,
  endContract,
  applyHrPrintPlaceholders,
  fetchAttestationPrintTemplate,
  fetchBulletinPreview,
  fetchCnssPreview,
  fetchContractPrintTemplate,
  fetchEmployee,
  fetchEmployeeDocuments,
  fetchIrppPreview,
  fetchJobTitles,
  fetchLevyPreview,
  fetchLinkableUsers,
  fetchDocKinds,
  hrEmployeeDocumentContentHref,
  isHrImageMime,
  isHrPreviewableMime,
  patchContract,
  patchEmployee,
  uploadEmployeeDocument,
  uploadEmployeePhoto,
  type BulletinPreview,
  type CnssPreview,
  type HrContract,
  type HrDocKind,
  type HrEmployee,
  type HrEmployeeDocument,
  type HrJobTitle,
  type HrLinkableUser,
  type IrppPreview,
  type LevyPreview,
} from "@/lib/hr";
import { softSelect } from "@/lib/d294-ui";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; employee: HrEmployee }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type DrawerMode =
  | "contract"
  | "contractEdit"
  | "genContract"
  | "genAttestation"
  | "cnss"
  | "irpp"
  | "bulletin"
  | "docPreview";

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
  const [siteId, setSiteId] = useState("");
  const [sites, setSites] = useState<
    Array<{ id: string; code: string; type: string; status: string }>
  >([]);
  const [cnssNo, setCnssNo] = useState("");
  const [cinNo, setCinNo] = useState("");
  const [address, setAddress] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [email, setEmail] = useState("");
  const [genLetterhead, setGenLetterhead] = useState("");
  const [genBody, setGenBody] = useState("");
  const [genFooter, setGenFooter] = useState("");
  const [genContractId, setGenContractId] = useState<string | null>(null);
  const [hiredAt, setHiredAt] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [leftAt, setLeftAt] = useState("");
  const [notes, setNotes] = useState("");
  const [taxChef, setTaxChef] = useState(false);
  const [taxEnfantCount, setTaxEnfantCount] = useState("0");
  const [docTitle, setDocTitle] = useState("");
  const [docKindId, setDocKindId] = useState("");
  const [docKinds, setDocKinds] = useState<HrDocKind[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [previewDoc, setPreviewDoc] = useState<HrEmployeeDocument | null>(null);
  const [linkableUsers, setLinkableUsers] = useState<HrLinkableUser[]>([]);
  const [linkUserId, setLinkUserId] = useState("");
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
  const [contractNotes, setContractNotes] = useState("");
  const [editContractId, setEditContractId] = useState<string | null>(null);
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
    setSiteId(row.siteId ?? "");
    setCnssNo(row.cnssNo ?? "");
    setCinNo(row.cinNo ?? "");
    setAddress(row.address ?? "");
    setBankName(row.bankName ?? "");
    setBankAgency(row.bankAgency ?? "");
    setBankAccount(row.bankAccount ?? "");
    setEmail(row.email ?? "");
    setHiredAt(dateInput(row.hiredAt));
    setStatus(row.status);
    setLeftAt(dateInput(row.leftAt));
    setNotes(row.notes ?? "");
    setTaxChef(row.taxChefDeFamille === true);
    setTaxEnfantCount(
      row.taxEnfantCount != null ? String(row.taxEnfantCount) : "0",
    );
    setLinkUserId(row.userId ?? "");
  }, []);

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const ctx = await fetchBusinessContext();
    const companyId = ctx.ok ? ctx.data.companyId : null;
    const sitesPromise = companyId
      ? listCompanySites(companyId)
      : Promise.resolve({
          ok: false as const,
          status: 0,
          message: "Contexte société manquant.",
        });
    const [res, titles, files, users, sitesRes, kinds] = await Promise.all([
      fetchEmployee(id),
      fetchJobTitles(),
      fetchEmployeeDocuments(id),
      fetchLinkableUsers(),
      sitesPromise,
      fetchDocKinds(),
    ]);
    if (titles.ok) setJobTitles(titles.data.items);
    if (files.ok) setDocs(files.data.items);
    if (users.ok) setLinkableUsers(users.data.items);
    if (sitesRes.ok) setSites(sitesRes.data);
    if (kinds.ok) setDocKinds(kinds.data.items);
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
      siteId: siteId || null,
      cnssNo: cnssNo.trim() || null,
      cinNo: cinNo.trim() || null,
      address: address.trim() || null,
      bankName: bankName.trim() || null,
      bankAgency: bankAgency.trim() || null,
      bankAccount: bankAccount.trim() || null,
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

  async function onLinkIdentity() {
    if (!id || !linkUserId) return;
    setBusy(true);
    setFormError(null);
    const res = await patchEmployee(id, { userId: linkUserId });
    if (res.ok) {
      const users = await fetchLinkableUsers();
      if (users.ok) setLinkableUsers(users.data.items);
      applyEmployee(res.data);
      setState({ kind: "ok", employee: res.data });
    } else {
      setFormError(res.message);
    }
    setBusy(false);
  }

  async function onUnlinkIdentity() {
    if (!id) return;
    setBusy(true);
    setFormError(null);
    const res = await patchEmployee(id, { userId: null });
    if (res.ok) {
      const users = await fetchLinkableUsers();
      if (users.ok) setLinkableUsers(users.data.items);
      applyEmployee(res.data);
      setState({ kind: "ok", employee: res.data });
    } else {
      setFormError(res.message);
    }
    setBusy(false);
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

  function openEditContract(c: HrContract) {
    setDrawerMode("contractEdit");
    setFormError(null);
    setEditContractId(c.id);
    setContractType(c.type);
    setStartDate(dateInput(c.startDate));
    setEndDate(dateInput(c.endDate));
    setWageRef(c.wageRef ?? "");
    setWageBase(c.wageBase ?? "");
    setContractNotes(c.notes ?? "");
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

  async function onPatchContract() {
    if (!editContractId) return;
    setBusy(true);
    setFormError(null);
    const res = await patchContract(editContractId, {
      type: contractType,
      startDate,
      endDate: endDate || null,
      wageRef: wageRef.trim() || null,
      wageBase: wageBase.trim() ? Number(wageBase) : null,
      notes: contractNotes.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load();
  }

  function mergeFieldsFor(
    emp: HrEmployee,
    contract: HrContract | null,
  ): Record<string, string> {
    return {
      companyName: "FATTORIE COVELLI GROUP sarl",
      vatNumber: "1327082/N/A/M000",
      employeeName: emp.displayName,
      matricule: emp.matricule,
      cnssNo: emp.cnssNo ?? "",
      cinNo: emp.cinNo ?? "",
      address: emp.address ?? "",
      bankName: emp.bankName ?? "",
      bankAgency: emp.bankAgency ?? "",
      bankAccount: emp.bankAccount ?? "",
      jobTitle: emp.jobTitle ?? "",
      department: emp.department ?? "",
      contractNumber: contract?.number ?? "",
      contractType: contract?.type ?? contractType,
      startDate: contract?.startDate?.slice(0, 10) ?? startDate,
      endDate: contract?.endDate?.slice(0, 10) ?? endDate,
      wageRef: contract?.wageRef ?? wageRef,
      wageBase: contract?.wageBase ?? wageBase,
      notes: contract?.notes ?? "",
      hiredAt: emp.hiredAt?.slice(0, 10) ?? "",
    };
  }

  async function openGenContract() {
    if (state.kind !== "ok") return;
    const emp = state.employee;
    const activeCtr =
      emp.contracts.find((c) => c.status === "ACTIVE") ?? null;
    setDrawerMode("genContract");
    setFormError(null);
    setGenContractId(activeCtr?.id ?? null);
    if (activeCtr) {
      setContractType(activeCtr.type);
      setStartDate(dateInput(activeCtr.startDate));
      setEndDate(dateInput(activeCtr.endDate));
      setWageRef(activeCtr.wageRef ?? "");
      setWageBase(activeCtr.wageBase ?? "");
      setContractNotes(activeCtr.notes ?? "");
    } else {
      setContractType("CDI");
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate("");
      setWageRef("");
      setWageBase("");
      setContractNotes("");
    }
    const tpl = await fetchContractPrintTemplate();
    const fields = mergeFieldsFor(emp, activeCtr);
    if (tpl.ok) {
      setGenLetterhead(applyHrPrintPlaceholders(tpl.data.letterhead, fields));
      setGenBody(applyHrPrintPlaceholders(tpl.data.bodyHtml, fields));
      setGenFooter(applyHrPrintPlaceholders(tpl.data.footer, fields));
    } else {
      setGenLetterhead("");
      setGenBody(
        `Contrat ${fields.contractType} — ${fields.employeeName} (${fields.matricule})\nCIN ${fields.cinNo} · CNSS ${fields.cnssNo}\nAdresse ${fields.address}`,
      );
      setGenFooter("");
    }
    setDrawerOpen(true);
  }

  async function openGenAttestation() {
    if (state.kind !== "ok") return;
    const emp = state.employee;
    const activeCtr = emp.contracts.find((c) => c.status === "ACTIVE");
    if (!activeCtr) {
      setFormError(
        "Créez d’abord un contrat ACTIVE (ou utilisez Générer contrat).",
      );
      return;
    }
    setDrawerMode("genAttestation");
    setFormError(null);
    setGenContractId(activeCtr.id);
    const tpl = await fetchAttestationPrintTemplate();
    const fields = mergeFieldsFor(emp, activeCtr);
    if (tpl.ok) {
      setGenLetterhead(applyHrPrintPlaceholders(tpl.data.letterhead, fields));
      setGenBody(applyHrPrintPlaceholders(tpl.data.bodyHtml, fields));
      setGenFooter(applyHrPrintPlaceholders(tpl.data.footer, fields));
    } else {
      setGenLetterhead("");
      setGenBody(
        `Attestation — ${fields.employeeName} (${fields.matricule})\nContrat ${fields.contractType} ${fields.contractNumber} depuis ${fields.startDate}`,
      );
      setGenFooter("");
    }
    setDrawerOpen(true);
  }

  async function onConfirmGenContract() {
    if (!id || state.kind !== "ok") return;
    setBusy(true);
    setFormError(null);
    let contractId = genContractId;
    if (!contractId) {
      const created = await createContract({
        employeeId: id,
        type: contractType,
        startDate,
        endDate: endDate || undefined,
        wageRef: wageRef.trim() || undefined,
        wageBase: wageBase.trim() ? Number(wageBase) : undefined,
      });
      if (!created.ok) {
        setBusy(false);
        setFormError(created.message);
        return;
      }
      contractId = created.data.id;
    } else {
      const patched = await patchContract(contractId, {
        type: contractType,
        startDate,
        endDate: endDate || null,
        wageRef: wageRef.trim() || null,
        wageBase: wageBase.trim() ? Number(wageBase) : null,
        notes: contractNotes.trim() || null,
      });
      if (!patched.ok) {
        setBusy(false);
        setFormError(patched.message);
        return;
      }
    }
    const res = await downloadContractPdf(contractId, {
      bodyHtml: genBody,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load();
  }

  async function onConfirmGenAttestation() {
    if (!id) return;
    setBusy(true);
    setFormError(null);
    const res = await downloadAttestationPdf(id, {
      bodyHtml: genBody,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
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
    const res = await uploadEmployeeDocument(id, docFile, {
      title: docTitle.trim() || undefined,
      kindId: docKindId || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDocFile(null);
    setDocTitle("");
    setDocKindId("");
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

  const overflowItems = useMemo((): AOverflowItem[] => {
    if (!employee || !active) return [];
    const items: AOverflowItem[] = [
      {
        id: "gen-contract",
        label: "Générer contrat",
        onSelect: () => void openGenContract(),
        disabled: busy,
      },
      {
        id: "gen-attestation",
        label: "Générer attestation",
        onSelect: () => void openGenAttestation(),
        disabled: busy,
      },
    ];
    return items;
  }, [employee, active, busy]);

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/hr" className="hover:text-a-fg">
            Employés
          </Link>
        }
        kicker="Ressources humaines"
        title={employee ? employee.displayName : "Fiche salarié"}
        description={
          employee
            ? `Matricule ${employee.matricule} · photo, identité, contrats, fiscal, dossier.`
            : "Photo, identité, contrats, fiscal, dossier."
        }
        status={
          employee ? (
            <ABadge tone={statusTone(employee.status)}>
              {employee.status}
            </ABadge>
          ) : undefined
        }
        primary={
          employee ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy || !displayName.trim()}
              onClick={() => void onSaveIdentity()}
            >
              {LAYOUT_ACTIONS.save}
            </AButton>
          ) : undefined
        }
        more={
          overflowItems.length > 0 ? (
            <AOverflowMenu items={overflowItems} />
          ) : undefined
        }
      />

      <APageBody>
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
          <ADetailGrid
            primary={
              <>
            <APageSection title="Identité">
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
                    Site / établissement
                  </span>
                  <select
                    className={softSelect}
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                  >
                    <option value="">— Aucun —</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.type}
                        {s.status !== "ACTIVE" ? ` (${s.status})` : ""}
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
                <label className="block space-y-1 md:col-span-2">
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
                <label className="block space-y-1 md:col-span-2">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    N° compte / RIB (TN · 20 chiffres · clé mod 97)
                  </span>
                  <AInput
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="a-mono"
                    placeholder="07 040 0058101111296 53"
                  />
                  {ribFieldHint(bankAccount) ? (
                    <span className="text-[length:var(--a-text-xs)] text-a-danger-fg">
                      {ribFieldHint(bankAccount)}
                    </span>
                  ) : (
                    <span className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                      IBAN TN accepté. Vide autorisé jusqu’au virement.
                    </span>
                  )}
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
            </APageSection>

            <APageSection
              title="Compte Identity"
              description="Lien optionnel vers un compte ERP déjà affecté à la société. Ne crée pas d’utilisateur — Délier ne le supprime pas."
            >
              {employee.linkedUser ? (
                <div className="flex flex-wrap items-center gap-3 rounded-md bg-a-surface-3 px-3 py-2">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-[length:var(--a-text-sm)] font-medium text-a-fg">
                      {employee.linkedUser.displayName}
                    </p>
                    <p className="truncate text-[length:var(--a-text-xs)] text-a-fg-muted">
                      {employee.linkedUser.email}
                    </p>
                  </div>
                  <ABadge
                    tone={
                      employee.linkedUser.status === "ACTIVE"
                        ? "success"
                        : "neutral"
                    }
                  >
                    {employee.linkedUser.status}
                  </ABadge>
                  <AButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void onUnlinkIdentity()}
                  >
                    Délier
                  </AButton>
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-[16rem] flex-1 space-y-1">
                    <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                      Utilisateur company
                    </span>
                    <select
                      className={softSelect}
                      value={linkUserId}
                      onChange={(e) => setLinkUserId(e.target.value)}
                    >
                      <option value="">— Choisir —</option>
                      {linkableUsers.map((u) => {
                        const taken =
                          u.linkedEmployeeId != null &&
                          u.linkedEmployeeId !== employee.id;
                        return (
                          <option
                            key={u.id}
                            value={u.id}
                            disabled={taken}
                          >
                            {u.displayName} · {u.email}
                            {taken ? " (déjà lié)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <AButton
                    type="button"
                    disabled={busy || !linkUserId}
                    onClick={() => void onLinkIdentity()}
                  >
                    Lier
                  </AButton>
                </div>
              )}
            </APageSection>

            <APageSection
              title="Situation fiscale"
              description="Défauts employé — figés dans le snapshot IRPP. Obligatoires si Prefs abattements VALIDATED."
            >
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
            </APageSection>

            <APageSection
              title="Contrats & documents"
              description="Générer un contrat ou une attestation — texte librement modifiable avant le PDF."
            >
              {employee.contracts.length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucun contrat — « Générer contrat » en crée un
                  automatiquement.
                </p>
              ) : (
                <ASoftTable className="min-w-[640px]">
                  <ASoftThead>
                    <ASoftTr>
                      <ASoftTh>N°</ASoftTh>
                      <ASoftTh>Type</ASoftTh>
                      <ASoftTh>Période</ASoftTh>
                      <ASoftTh>Base TND</ASoftTh>
                      <ASoftTh>Statut</ASoftTh>
                      <ASoftTh>Actions</ASoftTh>
                    </ASoftTr>
                  </ASoftThead>
                  <tbody>
                    {employee.contracts.map((c) => (
                      <ASoftTr key={c.id}>
                        <ASoftTd className="a-mono">{c.number}</ASoftTd>
                        <ASoftTd>
                          <ABadge tone="accent">{c.type}</ABadge>
                        </ASoftTd>
                        <ASoftTd className="a-mono">
                          {c.startDate}
                          {c.endDate ? ` → ${c.endDate}` : ""}
                        </ASoftTd>
                        <ASoftTd className="a-mono tabular-nums">
                          {c.wageBase ?? "—"}
                        </ASoftTd>
                        <ASoftTd>
                          <ABadge tone={statusTone(c.status)}>
                            {c.status}
                          </ABadge>
                        </ASoftTd>
                        <ASoftTd>
                          {c.status === "ACTIVE" ? (
                            <div className="flex flex-wrap gap-1">
                              <AButton
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => openEditContract(c)}
                              >
                                Modifier
                              </AButton>
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
                        </ASoftTd>
                      </ASoftTr>
                    ))}
                  </tbody>
                </ASoftTable>
              )}
            </APageSection>

            <APageSection
              title="Dossier personnel"
              description="Documents internes (Documents · HR_EMPLOYEE). Aperçu et impression same-origin. Pas de portail client."
            >
              {docs.length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucun document.
                </p>
              ) : (
                <ASoftTable className="min-w-[560px]">
                  <ASoftThead>
                    <ASoftTr>
                      <ASoftTh>Fichier</ASoftTh>
                      <ASoftTh>Kind</ASoftTh>
                      <ASoftTh>MIME</ASoftTh>
                      <ASoftTh>Actions</ASoftTh>
                    </ASoftTr>
                  </ASoftThead>
                  <tbody>
                    {docs.map((d) => {
                      const href = hrEmployeeDocumentContentHref(id, d.id);
                      const previewable = isHrPreviewableMime(d.mime);
                      const image = isHrImageMime(d.mime);
                      return (
                        <ASoftTr key={d.id}>
                          <ASoftTd>
                            <span className="a-mono">{d.number}</span>
                            {" · "}
                            {d.title}
                            {d.id === employee.photoDocumentId ? (
                              <>
                                {" "}
                                <ABadge tone="accent">Photo</ABadge>
                              </>
                            ) : null}
                          </ASoftTd>
                          <ASoftTd>
                            {d.hrDocKind
                              ? `${d.hrDocKind.code} · ${d.hrDocKind.name}`
                              : "—"}
                          </ASoftTd>
                          <ASoftTd className="text-a-fg-muted">
                            {d.mime || "—"}
                          </ASoftTd>
                          <ASoftTd>
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
                          </ASoftTd>
                        </ASoftTr>
                      );
                    })}
                  </tbody>
                </ASoftTable>
              )}
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Kind (catalogue)
                </span>
                <select
                  className={softSelect}
                  value={docKindId}
                  onChange={(e) => setDocKindId(e.target.value)}
                >
                  <option value="">— Aucun —</option>
                  {docKinds
                    .filter((k) => k.active)
                    .map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.code} · {k.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Titre
                </span>
                <AInput
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="Libellé libre — ex. scan recto"
                />
              </label>
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Catalogue vide jusqu’à saisie sur{" "}
                <Link href="/hr?tab=kinds" className="text-a-accent hover:underline">
                  /hr · Kinds
                </Link>
                — pas de CIN/contrat inventés.
              </p>
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
            </APageSection>
              </>
            }
            context={
              <AContextPanel title="Synthèse">
                <dl className="space-y-2 text-[length:var(--a-text-sm)]">
                  <div>
                    <dt className="text-a-fg-muted">Matricule</dt>
                    <dd className="a-mono">{employee.matricule}</dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Poste</dt>
                    <dd>
                      {[employee.jobTitle, employee.department]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">CNSS n°</dt>
                    <dd className="a-mono">{employee.cnssNo ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Contrats actifs</dt>
                    <dd className="a-mono">
                      {employee.contracts.filter((c) => c.status === "ACTIVE")
                        .length || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Identity</dt>
                    <dd>
                      {employee.linkedUser
                        ? employee.linkedUser.displayName
                        : "Non lié"}
                    </dd>
                  </div>
                </dl>
              </AContextPanel>
            }
            below={
              <>
                <AttendanceCalendarPanel employeeId={id} mode="adv" />
                <HrUpcomingLots />
              </>
            }
          />
        ) : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={
          drawerMode === "contract"
            ? "Nouveau contrat"
            : drawerMode === "contractEdit"
              ? "Modifier le contrat"
              : drawerMode === "genContract"
                ? "Générer contrat"
                : drawerMode === "genAttestation"
                  ? "Générer attestation"
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

          {drawerMode === "contract" || drawerMode === "contractEdit" ? (
            <>
              {drawerMode === "contractEdit" ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  ACTIVE uniquement. Pour le PDF : bouton « Générer contrat ».
                </p>
              ) : null}
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
              {drawerMode === "contractEdit" ? (
                <label className="block space-y-1">
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Notes
                  </span>
                  <textarea
                    value={contractNotes}
                    onChange={(e) => setContractNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-md bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg outline-none ring-a-accent focus:ring-2"
                  />
                </label>
              ) : null}
              <AButton
                type="button"
                disabled={busy || !startDate}
                onClick={() =>
                  void (drawerMode === "contractEdit"
                    ? onPatchContract()
                    : onCreateContract())
                }
              >
                {drawerMode === "contractEdit"
                  ? "Enregistrer"
                  : "Créer le contrat"}
              </AButton>
            </>
          ) : null}

          {drawerMode === "genContract" || drawerMode === "genAttestation" ? (
            <>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                {drawerMode === "genContract"
                  ? genContractId
                    ? "Contrat ACTIVE — ajustez les champs et le texte, puis téléchargez."
                    : "Aucun contrat ACTIVE — un CDI sera créé automatiquement."
                  : "Texte prérempli depuis la fiche — modifiable librement avant PDF."}
              </p>
              {drawerMode === "genContract" ? (
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
                      Réf. salaire
                    </span>
                    <AInput
                      value={wageRef}
                      onChange={(e) => setWageRef(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                      Base TND
                    </span>
                    <AInput
                      value={wageBase}
                      onChange={(e) => setWageBase(e.target.value)}
                      className="a-mono"
                    />
                  </label>
                </>
              ) : null}
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Corps du document (modifiable)
                </span>
                <textarea
                  value={genBody}
                  onChange={(e) => setGenBody(e.target.value)}
                  rows={12}
                  className="w-full rounded-md bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg outline-none ring-a-accent focus:ring-2"
                />
              </label>
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                En-tête logo + coordonnées Fattorie Covelli et pied de page sont
                appliqués automatiquement.
              </p>
              <AButton
                type="button"
                disabled={
                  busy ||
                  (drawerMode === "genContract" && !startDate)
                }
                onClick={() =>
                  void (drawerMode === "genContract"
                    ? onConfirmGenContract()
                    : onConfirmGenAttestation())
                }
              >
                {drawerMode === "genContract"
                  ? "Télécharger le contrat PDF"
                  : "Télécharger l’attestation PDF"}
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
