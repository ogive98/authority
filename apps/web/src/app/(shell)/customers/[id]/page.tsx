"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  ASwitch,
  type AOverflowItem,
} from "@/components/a";
import { FulfillmentDocToggle } from "@/components/fulfillment-doc-toggle";
import {
  ADDRESS_TYPE_LABELS,
  PORTAL_ROLE_LABELS,
  STATUS_LABELS,
  addCustomerContact,
  blockCustomer,
  createCustomerAddress,
  createPortalMembership,
  deleteCustomerAddress,
  deleteCustomerFiscalOverride,
  deleteCustomerPrice,
  fetchCustomerCommunications,
  fetchCustomerDocuments,
  fetchCustomerFiscal,
  fetchCustomerSummary,
  fetchCustomerTimeline,
  fetchCustomerZones,
  fetchPortalLinkableUsers,
  fetchPortalMemberships,
  setCustomerCredit,
  unblockCustomer,
  updateCustomer,
  updatePortalMembership,
  upsertCustomerFiscalOverride,
  upsertCustomerFiscalProfile,
  upsertCustomerPrice,
  type Customer,
  type CustomerAddressType,
  type CustomerCommunications,
  type CustomerDocumentItem,
  type CustomerFiscal,
  type CustomerStatus,
  type CustomerSummary,
  type CustomerTimelineItem,
  type CustomerZone,
  type FiscalOverrideMode,
  FISCAL_OVERRIDE_LABELS,
  FULFILLMENT_DOC_LABELS,
  type FulfillmentDoc,
  type PortalLinkableUser,
  type PortalMembership,
  type PortalMembershipRole,
} from "@/lib/customers";
import {
  softChipClass,
  softSelect,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: CustomerSummary }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FicheTab = "overview" | "documents" | "communications";

type EditForm = {
  legalName: string;
  nickname: string;
  taxId: string;
  salesRep: string;
  paymentTerms: string;
  creditLimit: string;
  zoneId: string;
  status: CustomerStatus;
  salubritaEmail: boolean;
  salubritaWhatsapp: boolean;
  salubritaPortal: boolean;
  enableCreditControl: boolean;
  alertBeforeCreditLimit: boolean;
  blockOnCreditLimit: boolean;
  allowExceptionalOverride: boolean;
  blockOnCriticalOverdue: boolean;
  notifyResponsible: boolean;
  fulfillmentDoc: FulfillmentDoc;
};

const ADDRESS_TYPES = Object.keys(ADDRESS_TYPE_LABELS) as CustomerAddressType[];
const LIFECYCLE_STATUSES: CustomerStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "PROSPECT",
  "ON_HOLD",
  "ARCHIVED",
];

function money(v: string | null | undefined): string {
  if (v == null || v === "") return "—";
  return `${v} TND`;
}

function severityTone(
  s: CustomerSummary["actionRequired"][number]["severity"],
): "danger" | "warning" | "info" | "neutral" {
  if (s === "critical" || s === "high") return "danger";
  if (s === "medium") return "warning";
  return "info";
}

function vatLiableSelect(value: boolean | null): "" | "true" | "false" {
  if (value === true) return "true";
  if (value === false) return "false";
  return "";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function Customer360Page() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [timeline, setTimeline] = useState<CustomerTimelineItem[]>([]);
  const [zones, setZones] = useState<CustomerZone[]>([]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<FicheTab>("overview");
  const [docs, setDocs] = useState<CustomerDocumentItem[] | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [comms, setComms] = useState<CustomerCommunications | null>(null);
  const [commsError, setCommsError] = useState<string | null>(null);
  const [commsLoading, setCommsLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    email: "",
    role: "",
    isPrimary: false,
    canOrder: false,
    receiveInvoices: false,
    portalAccess: false,
  });
  const [contactError, setContactError] = useState<string | null>(null);

  const [addressOpen, setAddressOpen] = useState(false);
  const [addressForm, setAddressForm] = useState({
    type: "SHIPPING" as CustomerAddressType,
    label: "",
    line1: "",
    line2: "",
    city: "",
    governorate: "",
    postalCode: "",
    instructions: "",
    contactName: "",
    contactPhone: "",
    isPrimary: false,
  });
  const [addressError, setAddressError] = useState<string | null>(null);

  const [priceProducts, setPriceProducts] = useState<
    Array<{ id: string; sku: string; name: string }>
  >([]);
  const [priceProductId, setPriceProductId] = useState("");
  const [priceHt, setPriceHt] = useState("");
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  const [memberships, setMemberships] = useState<PortalMembership[]>([]);
  const [portalOpen, setPortalOpen] = useState(false);
  const [linkable, setLinkable] = useState<PortalLinkableUser[]>([]);
  const [portalUserId, setPortalUserId] = useState("");
  const [portalRole, setPortalRole] =
    useState<PortalMembershipRole>("buyer");
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalQ, setPortalQ] = useState("");

  const [fiscal, setFiscal] = useState<CustomerFiscal | null>(null);
  const [fiscalError, setFiscalError] = useState<string | null>(null);
  const [fiscalBusy, setFiscalBusy] = useState(false);
  const [fiscalRegime, setFiscalRegime] = useState("");
  const [fiscalStatus, setFiscalStatus] = useState("");
  const [fiscalCategory, setFiscalCategory] = useState("");
  const [vatLiable, setVatLiable] = useState<"" | "true" | "false">("");
  const [withholdingArEnabled, setWithholdingArEnabled] = useState(false);
  const [fiscalNotes, setFiscalNotes] = useState("");
  const [overrideTaxCodeId, setOverrideTaxCodeId] = useState("");
  const [overrideMode, setOverrideMode] =
    useState<FiscalOverrideMode>("NEVER");
  const [overrideJustification, setOverrideJustification] = useState("");
  const [overrideReference, setOverrideReference] = useState("");

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const [summaryRes, timelineRes, memRes, fiscalRes] = await Promise.all([
      fetchCustomerSummary(id),
      fetchCustomerTimeline(id, { limit: 20 }),
      fetchPortalMemberships(id),
      fetchCustomerFiscal(id),
    ]);
    if (!summaryRes.ok) {
      if (summaryRes.status === 403) {
        setState({ kind: "forbidden", message: summaryRes.message });
        return;
      }
      setState({
        kind: "error",
        message:
          summaryRes.status === 404
            ? "Client introuvable."
            : summaryRes.message,
      });
      return;
    }
    setState({ kind: "ok", data: summaryRes.data });
    setTimeline(timelineRes.ok ? timelineRes.data.items : []);
    setMemberships(memRes.ok ? memRes.data.items : []);
    if (fiscalRes.ok) {
      setFiscal(fiscalRes.data);
      setFiscalRegime(fiscalRes.data.profile.fiscalRegime ?? "");
      setFiscalStatus(fiscalRes.data.profile.fiscalStatus ?? "");
      setFiscalCategory(fiscalRes.data.profile.fiscalCategory ?? "");
      setVatLiable(vatLiableSelect(fiscalRes.data.profile.vatLiable));
      setWithholdingArEnabled(fiscalRes.data.profile.withholdingArEnabled);
      setFiscalNotes(fiscalRes.data.profile.notes ?? "");
      setFiscalError(null);
    } else {
      setFiscal(null);
      setFiscalError(fiscalRes.message);
    }
    setDocs(null);
    setComms(null);
    setTab("overview");
    setActionError(null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id || tab !== "documents" || docs !== null || docsLoading) return;
    setDocsLoading(true);
    setDocsError(null);
    void (async () => {
      const res = await fetchCustomerDocuments(id, { limit: 40 });
      setDocsLoading(false);
      if (!res.ok) {
        setDocsError(res.message);
        setDocs([]);
        return;
      }
      setDocs(res.data.items);
    })();
  }, [id, tab, docs, docsLoading]);

  useEffect(() => {
    if (!id || tab !== "communications" || comms !== null || commsLoading)
      return;
    setCommsLoading(true);
    setCommsError(null);
    void (async () => {
      const res = await fetchCustomerCommunications(id, { limit: 40 });
      setCommsLoading(false);
      if (!res.ok) {
        setCommsError(res.message);
        setComms(null);
        return;
      }
      setComms(res.data);
    })();
  }, [id, tab, comms, commsLoading]);

  useEffect(() => {
    void (async () => {
      const z = await fetchCustomerZones();
      if (z.ok) setZones(z.data);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/v1/products", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          items: Array<{
            id: string;
            sku: string;
            name: string;
            status?: string;
          }>;
        };
        setPriceProducts(
          data.items
            .filter(
              (p) =>
                !p.status || p.status === "ACTIVE" || p.status === "DRAFT",
            )
            .map((p) => ({ id: p.id, sku: p.sku, name: p.name })),
        );
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const summary = state.kind === "ok" ? state.data : null;
  const customer = summary?.customer ?? null;

  function openEdit(c: Customer) {
    setEditForm({
      legalName: c.legalName,
      nickname: c.nickname ?? "",
      taxId: c.taxId ?? "",
      salesRep: c.salesRep ?? "",
      paymentTerms: c.paymentTerms ?? "",
      creditLimit: c.creditLimit ?? "",
      zoneId: c.zoneId ?? "",
      status: c.status,
      salubritaEmail: c.salubritaEmail,
      salubritaWhatsapp: c.salubritaWhatsapp,
      salubritaPortal: c.salubritaPortal,
      enableCreditControl: c.enableCreditControl ?? false,
      alertBeforeCreditLimit: c.alertBeforeCreditLimit ?? true,
      blockOnCreditLimit: c.blockOnCreditLimit ?? false,
      allowExceptionalOverride: c.allowExceptionalOverride ?? false,
      blockOnCriticalOverdue: c.blockOnCriticalOverdue ?? false,
      notifyResponsible: c.notifyResponsible ?? false,
      fulfillmentDoc: c.fulfillmentDoc ?? "DELIVERY_NOTE",
    });
    setEditError(null);
    setEditOpen(true);
  }

  async function onSaveEdit() {
    if (!customer || !editForm) return;
    setBusy(true);
    setEditError(null);
    const res = await updateCustomer(customer.id, {
      legalName: editForm.legalName.trim(),
      nickname: editForm.nickname.trim() || undefined,
      taxId: editForm.taxId.trim() || undefined,
      salesRep: editForm.salesRep.trim() || undefined,
      paymentTerms: editForm.paymentTerms.trim() || undefined,
      zoneId: editForm.zoneId || null,
      status: editForm.status,
      salubritaEmail: editForm.salubritaEmail,
      salubritaWhatsapp: editForm.salubritaWhatsapp,
      salubritaPortal: editForm.salubritaPortal,
      enableCreditControl: editForm.enableCreditControl,
      alertBeforeCreditLimit: editForm.alertBeforeCreditLimit,
      blockOnCreditLimit: editForm.blockOnCreditLimit,
      allowExceptionalOverride: editForm.allowExceptionalOverride,
      blockOnCriticalOverdue: editForm.blockOnCriticalOverdue,
      notifyResponsible: editForm.notifyResponsible,
      fulfillmentDoc: editForm.fulfillmentDoc,
      version: customer.version,
    });
    if (!res.ok) {
      setBusy(false);
      setEditError(res.message);
      return;
    }
    let version = res.data.version;
    const nextCredit = editForm.creditLimit.trim();
    const prevCredit = customer.creditLimit ?? "";
    if (nextCredit !== prevCredit) {
      const creditRes = await setCustomerCredit(customer.id, {
        creditLimit: nextCredit || "0",
        version,
      });
      if (!creditRes.ok) {
        setBusy(false);
        setEditError(creditRes.message);
        await load();
        return;
      }
      version = creditRes.data.version;
    }
    setBusy(false);
    setEditOpen(false);
    await load();
  }

  async function onToggleBlock() {
    if (!customer) return;
    setBusy(true);
    setActionError(null);
    const res = customer.blocked
      ? await unblockCustomer(customer.id, { version: customer.version })
      : await blockCustomer(customer.id, {
          reason: "Blocage manuel (fiche 360)",
          version: customer.version,
        });
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await load();
  }

  async function onAddContact() {
    if (!customer || !contactForm.name.trim()) {
      setContactError("Nom requis.");
      return;
    }
    setBusy(true);
    setContactError(null);
    const res = await addCustomerContact(customer.id, {
      name: contactForm.name.trim(),
      phone: contactForm.phone.trim() || undefined,
      whatsapp: contactForm.whatsapp.trim() || undefined,
      email: contactForm.email.trim() || undefined,
      role: contactForm.role.trim() || undefined,
      isPrimary: contactForm.isPrimary,
      canOrder: contactForm.canOrder,
      receiveInvoices: contactForm.receiveInvoices,
      portalAccess: contactForm.portalAccess,
    });
    setBusy(false);
    if (!res.ok) {
      setContactError(res.message);
      return;
    }
    setContactOpen(false);
    setContactForm({
      name: "",
      phone: "",
      whatsapp: "",
      email: "",
      role: "",
      isPrimary: false,
      canOrder: false,
      receiveInvoices: false,
      portalAccess: false,
    });
    await load();
  }

  async function onAddAddress() {
    if (!customer || !addressForm.line1.trim()) {
      setAddressError("Adresse (ligne 1) requise.");
      return;
    }
    setBusy(true);
    setAddressError(null);
    const res = await createCustomerAddress(customer.id, {
      type: addressForm.type,
      label: addressForm.label.trim() || undefined,
      line1: addressForm.line1.trim(),
      line2: addressForm.line2.trim() || undefined,
      city: addressForm.city.trim() || undefined,
      governorate: addressForm.governorate.trim() || undefined,
      postalCode: addressForm.postalCode.trim() || undefined,
      instructions: addressForm.instructions.trim() || undefined,
      contactName: addressForm.contactName.trim() || undefined,
      contactPhone: addressForm.contactPhone.trim() || undefined,
      isPrimary: addressForm.isPrimary,
    });
    setBusy(false);
    if (!res.ok) {
      setAddressError(res.message);
      return;
    }
    setAddressOpen(false);
    setAddressForm({
      type: "SHIPPING",
      label: "",
      line1: "",
      line2: "",
      city: "",
      governorate: "",
      postalCode: "",
      instructions: "",
      contactName: "",
      contactPhone: "",
      isPrimary: false,
    });
    await load();
  }

  async function onRemoveAddress(addressId: string) {
    if (!customer) return;
    if (!window.confirm("Archiver cette adresse ?")) return;
    setBusy(true);
    const res = await deleteCustomerAddress(customer.id, addressId);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await load();
  }

  async function onSavePrice() {
    if (!customer || !priceProductId || !priceHt.trim()) return;
    const n = Number(priceHt.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      setPriceError("Prix invalide.");
      return;
    }
    setPriceBusy(true);
    setPriceError(null);
    const res = await upsertCustomerPrice(customer.id, {
      productId: priceProductId,
      unitPriceHt: n,
    });
    setPriceBusy(false);
    if (!res.ok) {
      setPriceError(res.message);
      return;
    }
    setPriceProductId("");
    setPriceHt("");
    await load();
  }

  async function onDeletePrice(productId: string) {
    if (!customer) return;
    setPriceBusy(true);
    const res = await deleteCustomerPrice(customer.id, productId);
    setPriceBusy(false);
    if (!res.ok) {
      setPriceError(res.message);
      return;
    }
    await load();
  }

  function applyFiscalLocal(data: CustomerFiscal) {
    setFiscal(data);
    setFiscalRegime(data.profile.fiscalRegime ?? "");
    setFiscalStatus(data.profile.fiscalStatus ?? "");
    setFiscalCategory(data.profile.fiscalCategory ?? "");
    setVatLiable(vatLiableSelect(data.profile.vatLiable));
    setWithholdingArEnabled(data.profile.withholdingArEnabled);
    setFiscalNotes(data.profile.notes ?? "");
    setFiscalError(null);
  }

  async function onSaveFiscalProfile() {
    if (!customer || !fiscal) return;
    setFiscalBusy(true);
    setFiscalError(null);
    const res = await upsertCustomerFiscalProfile(customer.id, {
      fiscalRegime: fiscalRegime.trim() || null,
      fiscalStatus: fiscalStatus.trim() || null,
      fiscalCategory: fiscalCategory.trim() || null,
      vatLiable: vatLiable === "" ? null : vatLiable === "true",
      withholdingArEnabled,
      notes: fiscalNotes.trim() || null,
      version: fiscal.profile.version,
    });
    setFiscalBusy(false);
    if (!res.ok) {
      setFiscalError(res.message);
      return;
    }
    applyFiscalLocal(res.data);
  }

  async function onSaveFiscalOverride() {
    if (!customer || !overrideTaxCodeId) {
      setFiscalError("Choisissez un code fiscal.");
      return;
    }
    if (
      overrideMode !== "AUTO" &&
      !overrideJustification.trim()
    ) {
      setFiscalError(
        "Justification obligatoire pour Toujours / Jamais / Confirmer.",
      );
      return;
    }
    setFiscalBusy(true);
    setFiscalError(null);
    const res = await upsertCustomerFiscalOverride(customer.id, {
      taxCodeId: overrideTaxCodeId,
      mode: overrideMode,
      justification: overrideJustification.trim() || null,
      reference: overrideReference.trim() || null,
    });
    setFiscalBusy(false);
    if (!res.ok) {
      setFiscalError(res.message);
      return;
    }
    applyFiscalLocal(res.data);
    setOverrideTaxCodeId("");
    setOverrideJustification("");
    setOverrideReference("");
  }

  async function onDeleteFiscalOverride(taxCodeId: string) {
    if (!customer) return;
    setFiscalBusy(true);
    setFiscalError(null);
    const res = await deleteCustomerFiscalOverride(customer.id, taxCodeId);
    setFiscalBusy(false);
    if (!res.ok) {
      setFiscalError(res.message);
      return;
    }
    applyFiscalLocal(res.data);
  }

  async function openPortalDrawer() {
    if (!customer) return;
    setPortalError(null);
    setPortalUserId("");
    setPortalRole("buyer");
    setPortalQ("");
    setPortalOpen(true);
    const res = await fetchPortalLinkableUsers(customer.id);
    if (res.ok) setLinkable(res.data.items);
    else setPortalError(res.message);
  }

  async function searchLinkable() {
    if (!customer) return;
    const res = await fetchPortalLinkableUsers(customer.id, portalQ);
    if (res.ok) setLinkable(res.data.items);
    else setPortalError(res.message);
  }

  async function onLinkPortalUser() {
    if (!customer || !portalUserId) {
      setPortalError("Sélectionnez un utilisateur.");
      return;
    }
    setBusy(true);
    setPortalError(null);
    const res = await createPortalMembership(customer.id, {
      userId: portalUserId,
      role: portalRole,
    });
    setBusy(false);
    if (!res.ok) {
      setPortalError(res.message);
      return;
    }
    setPortalOpen(false);
    await load();
  }

  async function onToggleMembership(m: PortalMembership) {
    if (!customer) return;
    setBusy(true);
    setActionError(null);
    const res = await updatePortalMembership(customer.id, m.id, {
      status: m.status === "ACTIVE" ? "REVOKED" : "ACTIVE",
      version: m.version,
    });
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await load();
  }

  async function onChangeMembershipRole(
    m: PortalMembership,
    role: PortalMembershipRole,
  ) {
    if (!customer || m.role === role) return;
    setBusy(true);
    setActionError(null);
    const res = await updatePortalMembership(customer.id, m.id, {
      role,
      version: m.version,
    });
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await load();
  }

  const overflowItems = useMemo((): AOverflowItem[] => {
    if (!customer) return [];
    return [
      {
        id: "sales",
        label: "Nouvelle commande",
        onSelect: () =>
          router.push(`/sales?customerId=${encodeURIComponent(customer.id)}`),
      },
      {
        id: "finance",
        label: "Hub finance",
        onSelect: () =>
          router.push(`/finance?customerId=${encodeURIComponent(customer.id)}`),
      },
      {
        id: "block",
        label: customer.blocked ? "Débloquer" : "Bloquer",
        danger: !customer.blocked,
        disabled: busy,
        onSelect: () => void onToggleBlock(),
      },
    ];
  }, [customer, busy, router]);

  const contacts = customer?.contacts ?? [];
  const addresses = customer?.addresses ?? [];
  const prices = customer?.prices ?? [];
  const pressure = summary?.finance.creditPressure;
  const aging = summary?.finance.aging;

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/customers" className="hover:text-a-fg">
            Clients
          </Link>
        }
        kicker="Clients · 360"
        title={
          customer
            ? customer.nickname
              ? `${customer.code} — ${customer.nickname}`
              : customer.code
            : "Client"
        }
        description={
          customer
            ? `${customer.legalName}${customer.taxId ? ` · MF ${customer.taxId}` : ""}`
            : "Fiche Soft Glass — synthèse, documents, communication (D244)."
        }
        status={
          customer ? (
            customer.blocked ? (
              <ABadge tone="danger">Bloqué</ABadge>
            ) : (
              <ABadge tone="success">
                {STATUS_LABELS[customer.status] ?? customer.status}
              </ABadge>
            )
          ) : undefined
        }
        primary={
          customer ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => openEdit(customer)}
            >
              Éditer
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
        {actionError ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger">
            {actionError}
          </p>
        ) : null}

        {state.kind === "loading" ? (
          <div className="space-y-3">
            <ASkeleton className="h-8 w-48" />
            <ASkeleton className="h-40 w-full" />
          </div>
        ) : null}

        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}

        {state.kind === "error" ? (
          <AErrorState message={state.message} onRetry={() => void load()} />
        ) : null}

        {summary && customer ? (
          <ADetailGrid
            primary={
              <>
                {customer.blocked ? (
                  <div className="a-underlay space-y-1 px-3 py-2 text-[length:var(--a-text-sm)]">
                    <p className="font-medium text-a-danger">Client bloqué</p>
                    <p className="text-a-fg-muted">
                      {customer.blockedReason?.trim() ||
                        "Aucun motif renseigné."}
                      {customer.blockedAt
                        ? ` · depuis ${customer.blockedAt.slice(0, 10)}`
                        : ""}
                    </p>
                  </div>
                ) : null}

                <div
                  className="flex flex-wrap gap-2"
                  role="tablist"
                  aria-label="Sections fiche client"
                >
                  {(
                    [
                      { id: "overview", label: "Synthèse" },
                      { id: "documents", label: "Documents" },
                      { id: "communications", label: "Communication" },
                    ] as const
                  ).map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === chip.id}
                      className={softChipClass(tab === chip.id)}
                      onClick={() => setTab(chip.id)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                <APageSection title="Indicateurs">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Kpi
                      label="Encours"
                      value={money(summary.finance.credit.outstandingBalance)}
                    />
                    <Kpi
                      label="Plafond"
                      value={money(summary.finance.credit.creditLimit)}
                    />
                    <Kpi
                      label="Dispo. crédit"
                      value={money(summary.finance.availableCredit)}
                    />
                    <Kpi
                      label="Échus"
                      value={String(summary.finance.overdueCount)}
                    />
                  </div>
                  {pressure?.level === "warn" || pressure?.level === "breach" ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <ABadge
                        tone={
                          pressure.level === "breach" ? "danger" : "warning"
                        }
                      >
                        {pressure.level === "breach"
                          ? "Crédit dépassé"
                          : "Pression crédit"}
                      </ABadge>
                      <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                        {pressure.ratio != null
                          ? `${Math.round(pressure.ratio * 100)}%`
                          : "—"}{" "}
                        du plafond
                        {pressure.warnRatio != null
                          ? ` · seuil ${Math.round(pressure.warnRatio * 100)}%`
                          : ""}
                      </span>
                    </div>
                  ) : null}
                </APageSection>

                {aging?.buckets?.length ? (
                  <APageSection title="Aging AR">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {aging.buckets.map((b) => (
                        <div key={b.key} className="a-underlay px-2 py-1.5">
                          <p className="text-[10px] text-a-fg-muted">
                            {b.label}
                          </p>
                          <p className="a-mono text-[length:var(--a-text-sm)] tabular-nums">
                            {b.amountOpen}
                          </p>
                          <p className="text-[10px] text-a-fg-muted">
                            {b.count} créance{b.count === 1 ? "" : "s"}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[length:var(--a-text-xs)] text-a-fg-muted">
                      {aging.asOf
                        ? `Au ${aging.asOf.slice(0, 10)} · `
                        : ""}
                      Échu total {money(aging.overdueTotal)} · TND as-recorded
                      (Finance)
                    </p>
                  </APageSection>
                ) : null}

                {summary.actionRequired.length > 0 ? (
                  <APageSection title="Action requise">
                    <ul className="space-y-2">
                      {summary.actionRequired.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <ABadge tone={severityTone(a.severity)}>
                            {a.severity}
                          </ABadge>
                          {a.href ? (
                            <Link
                              href={a.href}
                              className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
                            >
                              {a.label}
                            </Link>
                          ) : (
                            <span className="text-[length:var(--a-text-sm)]">
                              {a.label}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </APageSection>
                ) : null}

                {tab === "overview" ? (
                  <>
                <APageSection title="Vue d’ensemble">
                  <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
                    <div>
                      <dt className="text-a-fg-muted">Code</dt>
                      <dd className="a-mono">{customer.code}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Surnom</dt>
                      <dd>{customer.nickname ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Raison sociale</dt>
                      <dd>{customer.legalName}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">MF</dt>
                      <dd className="a-mono">{customer.taxId ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Zone</dt>
                      <dd>
                        {customer.zoneCode
                          ? `${customer.zoneCode}${customer.zoneName ? ` · ${customer.zoneName}` : ""}`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Commercial</dt>
                      <dd>{customer.salesRep ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Conditions</dt>
                      <dd>{customer.paymentTerms ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Document</dt>
                      <dd>
                        {
                          FULFILLMENT_DOC_LABELS[
                            customer.fulfillmentDoc ?? "DELIVERY_NOTE"
                          ]
                        }
                      </dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Crédit statut</dt>
                      <dd>{customer.creditStatus ?? "NORMAL"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Salubrité</dt>
                      <dd className="text-a-fg-muted">
                        {[
                          customer.salubritaEmail ? "Outlook" : null,
                          customer.salubritaWhatsapp ? "WhatsApp" : null,
                          customer.salubritaPortal ? "Portail" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Aucun canal"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Portail</dt>
                      <dd>
                        {
                          memberships.filter((m) => m.status === "ACTIVE")
                            .length
                        }{" "}
                        actif(s) · {memberships.length} total
                      </dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Commandes ouvertes</dt>
                      <dd>{summary.counts.openOrders}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Contrôle crédit</dt>
                      <dd>
                        {customer.enableCreditControl ? "Activé" : "Désactivé"}
                      </dd>
                    </div>
                  </dl>
                </APageSection>

                <APageSection
                  title="Fiscalité"
                  description="Profil client et dérogations par code. Les taux restent dans Fiscalité / Préférences — jamais inventés ici. NEVER = exonération justifiée, pas un contournement."
                >
                  {fiscalError ? (
                    <p className="mb-3 text-[length:var(--a-text-sm)] text-a-danger">
                      {fiscalError}
                    </p>
                  ) : null}
                  {!fiscal ? (
                    <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                      Profil fiscal indisponible.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
                        <div>
                          <dt className="text-a-fg-muted">MF (pièce d’identité)</dt>
                          <dd className="a-mono">{fiscal.taxId ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-a-fg-muted">RAS clients (AR)</dt>
                          <dd className="text-a-fg-muted">
                            Architecture seulement — non appliqué à la facture
                            (D246). RAS auto = fournisseurs (AP), plus tard.
                          </dd>
                        </div>
                      </dl>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Régime">
                          <AInput
                            value={fiscalRegime}
                            onChange={(e) => setFiscalRegime(e.target.value)}
                            placeholder="réel, forfait…"
                          />
                        </Field>
                        <Field label="Statut fiscal">
                          <AInput
                            value={fiscalStatus}
                            onChange={(e) => setFiscalStatus(e.target.value)}
                          />
                        </Field>
                        <Field label="Catégorie">
                          <AInput
                            value={fiscalCategory}
                            onChange={(e) => setFiscalCategory(e.target.value)}
                          />
                        </Field>
                        <Field label="Assujetti TVA">
                          <select
                            className={softSelect}
                            value={vatLiable}
                            onChange={(e) =>
                              setVatLiable(
                                e.target.value as "" | "true" | "false",
                              )
                            }
                          >
                            <option value="">Non renseigné</option>
                            <option value="true">Assujetti</option>
                            <option value="false">Non assujetti</option>
                          </select>
                        </Field>
                      </div>
                      <ToggleRow
                        label="RAS sur factures clients (AR)"
                        checked={withholdingArEnabled}
                        onChange={setWithholdingArEnabled}
                      />
                      <p className="text-[length:var(--a-text-xs)] text-a-muted">
                        Si activé + Prefs tax.ras VALIDATED : à l’émission
                        facture, une retenue CALCULATED est créée dans TEJ
                        Center (montants facture inchangés).
                      </p>
                      <Field label="Notes">
                        <AInput
                          value={fiscalNotes}
                          onChange={(e) => setFiscalNotes(e.target.value)}
                        />
                      </Field>
                      <AButton
                        type="button"
                        size="sm"
                        disabled={fiscalBusy}
                        onClick={() => void onSaveFiscalProfile()}
                      >
                        Enregistrer le fiscal
                      </AButton>

                      <div>
                        <p className="mb-2 text-[length:var(--a-text-sm)] font-medium">
                          Dérogations par code
                        </p>
                        {fiscal.overrides.length === 0 ? (
                          <p className="mb-3 text-[length:var(--a-text-sm)] text-a-fg-muted">
                            Aucune dérogation — le moteur applique les règles
                            ACTIVE.
                          </p>
                        ) : (
                          <div className={`${softTableWrap} mb-3`}>
                            <table className="w-full text-left text-[length:var(--a-text-sm)]">
                              <thead className={softThead}>
                                <tr>
                                  <th className="a-table-cell font-medium">
                                    Code
                                  </th>
                                  <th className="a-table-cell font-medium">
                                    Mode
                                  </th>
                                  <th className="a-table-cell font-medium">
                                    Justification
                                  </th>
                                  <th className="a-table-cell font-medium">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {fiscal.overrides.map((row) => (
                                  <tr key={row.id} className={softTr}>
                                    <td className="a-table-cell">
                                      <span className="a-mono">{row.taxCode}</span>
                                      <span className="text-a-fg-muted">
                                        {" "}
                                        · {row.taxLabel}
                                      </span>
                                    </td>
                                    <td className="a-table-cell">
                                      <ABadge tone="neutral">
                                        {FISCAL_OVERRIDE_LABELS[row.mode]}
                                      </ABadge>
                                    </td>
                                    <td className="a-table-cell">
                                      {row.justification ?? "—"}
                                    </td>
                                    <td className="a-table-cell">
                                      <AButton
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={fiscalBusy}
                                        onClick={() =>
                                          void onDeleteFiscalOverride(
                                            row.taxCodeId,
                                          )
                                        }
                                      >
                                        Auto
                                      </AButton>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="grid gap-2 lg:grid-cols-[1fr_10rem_1fr_auto]">
                          <select
                            className={softSelect}
                            value={overrideTaxCodeId}
                            onChange={(e) =>
                              setOverrideTaxCodeId(e.target.value)
                            }
                          >
                            <option value="">Code fiscal…</option>
                            {fiscal.availableCodes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.code} · {c.label} ({c.status})
                              </option>
                            ))}
                          </select>
                          <select
                            className={softSelect}
                            value={overrideMode}
                            onChange={(e) =>
                              setOverrideMode(
                                e.target.value as FiscalOverrideMode,
                              )
                            }
                          >
                            {(
                              Object.keys(
                                FISCAL_OVERRIDE_LABELS,
                              ) as FiscalOverrideMode[]
                            )
                              .filter((m) => m !== "AUTO")
                              .map((m) => (
                                <option key={m} value={m}>
                                  {FISCAL_OVERRIDE_LABELS[m]}
                                </option>
                              ))}
                          </select>
                          <AInput
                            value={overrideJustification}
                            onChange={(e) =>
                              setOverrideJustification(e.target.value)
                            }
                            placeholder="Justification"
                          />
                          <AButton
                            type="button"
                            size="sm"
                            disabled={fiscalBusy || !overrideTaxCodeId}
                            onClick={() => void onSaveFiscalOverride()}
                          >
                            Appliquer
                          </AButton>
                        </div>
                        <AInput
                          className="mt-2"
                          value={overrideReference}
                          onChange={(e) => setOverrideReference(e.target.value)}
                          placeholder="Référence (décision, certificat…)"
                        />
                      </div>
                    </div>
                  )}
                </APageSection>

                <APageSection
                  title="Portail"
                  description="Utilisateurs Identity liés à ce client (login /portal)."
                  action={
                    <AButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void openPortalDrawer()}
                    >
                      + Utilisateur portail
                    </AButton>
                  }
                >
                  {memberships.length === 0 ? (
                    <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                      Aucun utilisateur lié. Liez un compte Identity existant
                      (création de compte = module Identité).
                    </p>
                  ) : (
                    <div className={softTableWrap}>
                      <table className="w-full text-left text-[length:var(--a-text-sm)]">
                        <thead className={softThead}>
                          <tr>
                            <th className="a-table-cell font-medium">
                              Utilisateur
                            </th>
                            <th className="a-table-cell font-medium">Rôle</th>
                            <th className="a-table-cell font-medium">Statut</th>
                            <th className="a-table-cell font-medium">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberships.map((m) => (
                            <tr key={m.id} className={softTr}>
                              <td className="a-table-cell">
                                <div className="font-medium">
                                  {m.displayName}
                                </div>
                                <div className="a-mono text-a-fg-muted">
                                  {m.email}
                                </div>
                              </td>
                              <td className="a-table-cell">
                                <select
                                  className={softSelect}
                                  value={
                                    (["buyer", "viewer", "admin"] as const)
                                      .includes(
                                        m.role as PortalMembershipRole,
                                      )
                                      ? m.role
                                      : "buyer"
                                  }
                                  disabled={busy || m.status !== "ACTIVE"}
                                  onChange={(e) =>
                                    void onChangeMembershipRole(
                                      m,
                                      e.target.value as PortalMembershipRole,
                                    )
                                  }
                                >
                                  {(
                                    Object.keys(
                                      PORTAL_ROLE_LABELS,
                                    ) as PortalMembershipRole[]
                                  ).map((r) => (
                                    <option key={r} value={r}>
                                      {PORTAL_ROLE_LABELS[r]}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="a-table-cell">
                                <ABadge
                                  tone={
                                    m.status === "ACTIVE"
                                      ? "success"
                                      : "neutral"
                                  }
                                >
                                  {m.status === "ACTIVE"
                                    ? "Actif"
                                    : "Révoqué"}
                                </ABadge>
                              </td>
                              <td className="a-table-cell">
                                <AButton
                                  type="button"
                                  size="sm"
                                  variant={
                                    m.status === "ACTIVE" ? "ghost" : "secondary"
                                  }
                                  disabled={busy}
                                  onClick={() => void onToggleMembership(m)}
                                >
                                  {m.status === "ACTIVE"
                                    ? "Révoquer"
                                    : "Réactiver"}
                                </AButton>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </APageSection>

                <APageSection
                  title="Contacts"
                  action={
                    <AButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setContactError(null);
                        setContactOpen(true);
                      }}
                    >
                      + Contact
                    </AButton>
                  }
                >
                  {contacts.length === 0 ? (
                    <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                      Aucun contact.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-[length:var(--a-text-sm)]">
                      {contacts.map((c) => (
                        <li key={c.id} className="a-underlay px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{c.name}</span>
                            {c.isPrimary ? (
                              <ABadge tone="info">Principal</ABadge>
                            ) : null}
                            {c.canOrder ? (
                              <ABadge tone="neutral">Peut commander</ABadge>
                            ) : null}
                            {c.portalAccess ? (
                              <ABadge tone="neutral">Portail</ABadge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-a-fg-muted">
                            {[
                              c.role,
                              c.phone,
                              c.whatsapp ? `WA ${c.whatsapp}` : null,
                              c.email,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </APageSection>

                <APageSection
                  title="Adresses"
                  action={
                    <AButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setAddressError(null);
                        setAddressOpen(true);
                      }}
                    >
                      + Adresse
                    </AButton>
                  }
                >
                  {addresses.length === 0 ? (
                    <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                      Aucune adresse.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-[length:var(--a-text-sm)]">
                      {addresses.map((a) => (
                        <li
                          key={a.id}
                          className="a-underlay flex flex-wrap items-start justify-between gap-2 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <ABadge tone="neutral">
                                {ADDRESS_TYPE_LABELS[
                                  a.type as CustomerAddressType
                                ] ?? a.type}
                              </ABadge>
                              {a.isPrimary ? (
                                <ABadge tone="info">Principale</ABadge>
                              ) : null}
                              {a.label ? (
                                <span className="text-a-fg-muted">{a.label}</span>
                              ) : null}
                            </div>
                            <p className="mt-1">
                              {a.line1}
                              {a.line2 ? `, ${a.line2}` : ""}
                            </p>
                            <p className="text-a-fg-muted">
                              {[a.postalCode, a.city, a.governorate]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </p>
                            {a.contactName || a.contactPhone ? (
                              <p className="text-a-fg-muted">
                                {[a.contactName, a.contactPhone]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            ) : null}
                          </div>
                          <AButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void onRemoveAddress(a.id)}
                          >
                            Archiver
                          </AButton>
                        </li>
                      ))}
                    </ul>
                  )}
                </APageSection>

                <APageSection title="Tarifs négociés (HT TND)">
                  {priceError ? (
                    <p className="mb-2 text-[length:var(--a-text-sm)] text-a-danger">
                      {priceError}
                    </p>
                  ) : null}
                  {prices.length === 0 ? (
                    <p className="mb-3 text-[length:var(--a-text-sm)] text-a-fg-muted">
                      Aucun tarif agréé.
                    </p>
                  ) : (
                    <ul className="mb-3 space-y-1.5 text-[length:var(--a-text-sm)]">
                      {prices.map((p) => (
                        <li
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <span className="min-w-0 truncate">
                            {p.productSku ?? "SKU"} · {p.productName ?? "—"}
                          </span>
                          <span className="a-mono shrink-0 tabular-nums">
                            {p.unitPriceHt} {p.currency}
                          </span>
                          <AButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={priceBusy}
                            onClick={() => void onDeletePrice(p.productId)}
                          >
                            Retirer
                          </AButton>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
                    <select
                      className={softSelect}
                      value={priceProductId}
                      onChange={(e) => setPriceProductId(e.target.value)}
                    >
                      <option value="">Produit…</option>
                      {priceProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} · {p.name}
                        </option>
                      ))}
                    </select>
                    <AInput
                      value={priceHt}
                      onChange={(e) => setPriceHt(e.target.value)}
                      inputMode="decimal"
                      placeholder="0.000"
                      className="a-mono"
                    />
                    <AButton
                      type="button"
                      size="sm"
                      disabled={priceBusy || !priceProductId || !priceHt}
                      onClick={() => void onSavePrice()}
                    >
                      Enregistrer
                    </AButton>
                  </div>
                </APageSection>

                <APageSection title="Récents">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <RecentList
                      title="Commandes"
                      rows={summary.recent.orders.map((o) => ({
                        id: o.id,
                        href: `/sales/${o.id}`,
                        primary: o.number,
                        secondary: o.status,
                        amount: o.amountTotal,
                      }))}
                    />
                    <RecentList
                      title="Factures"
                      rows={summary.recent.invoices.map((i) => ({
                        id: i.id,
                        href: `/finance/invoices/${i.id}`,
                        primary: i.number,
                        secondary: i.status,
                        amount: i.amountTotal,
                      }))}
                    />
                    <RecentList
                      title="Encaissements"
                      rows={summary.recent.payments.map((p) => ({
                        id: p.id,
                        href: `/finance/payments/${p.id}`,
                        primary: p.number,
                        secondary: p.paymentDate ?? p.status,
                        amount: p.amount,
                      }))}
                    />
                    <RecentList
                      title="Livraisons"
                      rows={summary.recent.deliveries.map((d) => ({
                        id: d.id,
                        href: `/delivery`,
                        primary: d.number,
                        secondary: d.status,
                        amount: null,
                      }))}
                    />
                  </div>
                </APageSection>

                <APageSection title="Timeline">
                  {timeline.length === 0 ? (
                    <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                      Aucun événement récent.
                    </p>
                  ) : (
                    <div className={softTableWrap}>
                      <table className="w-full text-left text-[length:var(--a-text-sm)]">
                        <thead className={softThead}>
                          <tr>
                            <th className="a-table-cell font-medium">Date</th>
                            <th className="a-table-cell font-medium">
                              Événement
                            </th>
                            <th className="a-table-cell font-medium">Statut</th>
                            <th className="a-table-cell font-medium">Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timeline.map((item) => (
                            <tr key={item.id} className={softTr}>
                              <td className="a-mono a-table-cell text-a-fg-muted">
                                {item.at.slice(0, 10)}
                              </td>
                              <td className="a-table-cell">
                                <Link
                                  href={item.href}
                                  className="text-a-accent hover:underline"
                                >
                                  {item.title}
                                </Link>
                              </td>
                              <td className="a-table-cell text-a-fg-muted">
                                {item.status}
                              </td>
                              <td className="a-mono a-table-cell">
                                {item.amount ? money(item.amount) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </APageSection>
                  </>
                ) : null}

                {tab === "documents" ? (
                  <APageSection
                    title="Documents"
                    action={
                      <Link
                        href={`/documents`}
                        className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
                      >
                        Bibliothèque
                      </Link>
                    }
                  >
                    <p className="mb-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
                      Fichiers liés à ce client (CLAIM / ORDER / SHIPMENT /
                      CUSTOMER). Dépôt via Documents · type de lien CUSTOMER.
                    </p>
                    {docsLoading ? (
                      <ASkeleton className="h-24 w-full" />
                    ) : docsError ? (
                      <p className="text-[length:var(--a-text-sm)] text-a-danger">
                        {docsError}
                      </p>
                    ) : !docs || docs.length === 0 ? (
                      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                        Aucun document rattaché.
                      </p>
                    ) : (
                      <div className={softTableWrap}>
                        <table className="w-full text-left text-[length:var(--a-text-sm)]">
                          <thead className={softThead}>
                            <tr>
                              <th className="a-table-cell font-medium">N°</th>
                              <th className="a-table-cell font-medium">
                                Titre
                              </th>
                              <th className="a-table-cell font-medium">Lien</th>
                              <th className="a-table-cell font-medium">Vis.</th>
                              <th className="a-table-cell font-medium">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {docs.map((d) => (
                              <tr key={d.id} className={softTr}>
                                <td className="a-mono a-table-cell">
                                  {d.number}
                                </td>
                                <td className="a-table-cell">{d.title}</td>
                                <td className="a-table-cell text-a-fg-muted">
                                  {d.linkType}
                                </td>
                                <td className="a-table-cell">
                                  <ABadge
                                    tone={
                                      d.visibility === "CUSTOMER_PORTAL"
                                        ? "accent"
                                        : "neutral"
                                    }
                                  >
                                    {d.visibility === "CUSTOMER_PORTAL"
                                      ? "Portail"
                                      : "Interne"}
                                  </ABadge>
                                </td>
                                <td className="a-mono a-table-cell text-a-fg-muted">
                                  {d.createdAt.slice(0, 10)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </APageSection>
                ) : null}

                {tab === "communications" ? (
                  <>
                    {commsLoading ? (
                      <ASkeleton className="h-32 w-full" />
                    ) : commsError ? (
                      <p className="text-[length:var(--a-text-sm)] text-a-danger">
                        {commsError}
                      </p>
                    ) : comms ? (
                      <>
                        <APageSection title="Canaux">
                          <div className="flex flex-wrap gap-2">
                            <ABadge
                              tone={
                                comms.channels.salubritaEmail
                                  ? "success"
                                  : "neutral"
                              }
                            >
                              Salubrité e-mail
                            </ABadge>
                            <ABadge
                              tone={
                                comms.channels.salubritaWhatsapp
                                  ? "success"
                                  : "neutral"
                              }
                            >
                              Salubrité WA
                            </ABadge>
                            <ABadge
                              tone={
                                comms.channels.salubritaPortal
                                  ? "success"
                                  : "neutral"
                              }
                            >
                              Salubrité portail
                            </ABadge>
                            <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                              {comms.channels.contactsWithEmail} e-mail ·{" "}
                              {comms.channels.contactsWithWhatsapp} WhatsApp
                            </span>
                          </div>
                          <p className="mt-2 text-[length:var(--a-text-xs)] text-a-fg-muted">
                            Pas de CRM messagerie — relances = dunning Finance
                            human-gated (D244).
                          </p>
                        </APageSection>

                        <APageSection title="Contacts (canaux)">
                          {comms.contacts.length === 0 ? (
                            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                              Aucun contact.
                            </p>
                          ) : (
                            <div className={softTableWrap}>
                              <table className="w-full text-left text-[length:var(--a-text-sm)]">
                                <thead className={softThead}>
                                  <tr>
                                    <th className="a-table-cell font-medium">
                                      Nom
                                    </th>
                                    <th className="a-table-cell font-medium">
                                      E-mail
                                    </th>
                                    <th className="a-table-cell font-medium">
                                      WhatsApp
                                    </th>
                                    <th className="a-table-cell font-medium">
                                      Flags
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {comms.contacts.map((c) => (
                                    <tr key={c.id} className={softTr}>
                                      <td className="a-table-cell">
                                        {c.name}
                                        {c.isPrimary ? (
                                          <ABadge
                                            tone="accent"
                                            className="ml-2"
                                          >
                                            Principal
                                          </ABadge>
                                        ) : null}
                                      </td>
                                      <td className="a-table-cell text-a-fg-muted">
                                        {c.email ?? "—"}
                                      </td>
                                      <td className="a-mono a-table-cell text-a-fg-muted">
                                        {c.whatsapp ?? "—"}
                                      </td>
                                      <td className="a-table-cell text-a-fg-muted">
                                        {[
                                          c.receiveInvoices
                                            ? "Factures"
                                            : null,
                                          c.receiveDunning
                                            ? "Relances"
                                            : null,
                                          c.portalAccess ? "Portail" : null,
                                        ]
                                          .filter(Boolean)
                                          .join(" · ") || "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </APageSection>

                        <APageSection title="Relances (dunning)">
                          {comms.dunning.length === 0 ? (
                            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                              Aucune relance enregistrée.
                            </p>
                          ) : (
                            <div className={softTableWrap}>
                              <table className="w-full text-left text-[length:var(--a-text-sm)]">
                                <thead className={softThead}>
                                  <tr>
                                    <th className="a-table-cell font-medium">
                                      N°
                                    </th>
                                    <th className="a-table-cell font-medium">
                                      Canal
                                    </th>
                                    <th className="a-table-cell font-medium">
                                      Statut
                                    </th>
                                    <th className="a-table-cell font-medium">
                                      Montant
                                    </th>
                                    <th className="a-table-cell font-medium">
                                      Date
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {comms.dunning.map((d) => (
                                    <tr key={d.id} className={softTr}>
                                      <td className="a-table-cell">
                                        <Link
                                          href={d.href}
                                          className="a-mono text-a-accent hover:underline"
                                        >
                                          {d.number}
                                        </Link>
                                      </td>
                                      <td className="a-table-cell">
                                        {d.channel}
                                      </td>
                                      <td className="a-table-cell text-a-fg-muted">
                                        {d.status}
                                        {d.sendStatus !== "NONE"
                                          ? ` · ${d.sendStatus}`
                                          : ""}
                                      </td>
                                      <td className="a-mono a-table-cell">
                                        {d.amountOpen} {d.currency}
                                      </td>
                                      <td className="a-mono a-table-cell text-a-fg-muted">
                                        {(d.sentAt ?? d.createdAt).slice(0, 10)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </APageSection>

                        <APageSection title="Déclarations portail">
                          {comms.paymentDeclarations.length === 0 ? (
                            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                              Aucune déclaration de paiement.
                            </p>
                          ) : (
                            <div className={softTableWrap}>
                              <table className="w-full text-left text-[length:var(--a-text-sm)]">
                                <thead className={softThead}>
                                  <tr>
                                    <th className="a-table-cell font-medium">
                                      N°
                                    </th>
                                    <th className="a-table-cell font-medium">
                                      Montant
                                    </th>
                                    <th className="a-table-cell font-medium">
                                      Statut
                                    </th>
                                    <th className="a-table-cell font-medium">
                                      Date
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {comms.paymentDeclarations.map((p) => (
                                    <tr key={p.id} className={softTr}>
                                      <td className="a-table-cell">
                                        <Link
                                          href={p.href}
                                          className="a-mono text-a-accent hover:underline"
                                        >
                                          {p.number}
                                        </Link>
                                      </td>
                                      <td className="a-mono a-table-cell">
                                        {p.amount} {p.currency}
                                      </td>
                                      <td className="a-table-cell text-a-fg-muted">
                                        {p.status}
                                      </td>
                                      <td className="a-mono a-table-cell text-a-fg-muted">
                                        {p.paymentDate}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </APageSection>
                      </>
                    ) : null}
                  </>
                ) : null}
              </>
            }
            context={
              <AContextPanel title="Actions rapides">
                <ul className="space-y-2 text-[length:var(--a-text-sm)]">
                  <li>
                    <button
                      type="button"
                      className="text-a-accent hover:underline"
                      onClick={() => openEdit(customer)}
                    >
                      Éditer la fiche
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="text-a-accent hover:underline"
                      onClick={() => setTab("documents")}
                    >
                      Documents
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="text-a-accent hover:underline"
                      onClick={() => setTab("communications")}
                    >
                      Communication
                    </button>
                  </li>
                  <li>
                    <Link
                      href={`/sales?customerId=${encodeURIComponent(customer.id)}`}
                      className="text-a-accent hover:underline"
                    >
                      Nouvelle commande
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`/finance?customerId=${encodeURIComponent(customer.id)}`}
                      className="text-a-accent hover:underline"
                    >
                      Créances / aging
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`/finance/invoices?customerId=${encodeURIComponent(customer.id)}`}
                      className="text-a-accent hover:underline"
                    >
                      Factures
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`/finance/payments?customerId=${encodeURIComponent(customer.id)}`}
                      className="text-a-accent hover:underline"
                    >
                      Encaissements
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/delivery"
                      className="text-a-accent hover:underline"
                    >
                      Livraisons
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/customers"
                      className="text-a-accent hover:underline"
                    >
                      Retour liste
                    </Link>
                  </li>
                </ul>
              </AContextPanel>
            }
          />
        ) : null}
      </APageBody>

      <ADrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Éditer client"
        description="Identité, crédit, salubrité, toggles"
        footer={
          <div className="flex justify-end gap-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditOpen(false)}
            >
              Annuler
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy || !editForm}
              onClick={() => void onSaveEdit()}
            >
              {busy ? "…" : "Enregistrer"}
            </AButton>
          </div>
        }
      >
        {editForm ? (
          <div className="space-y-4 p-4">
            <Field label="Raison sociale">
              <AInput
                value={editForm.legalName}
                onChange={(e) =>
                  setEditForm({ ...editForm, legalName: e.target.value })
                }
              />
            </Field>
            <Field label="Surnom">
              <AInput
                value={editForm.nickname}
                onChange={(e) =>
                  setEditForm({ ...editForm, nickname: e.target.value })
                }
              />
            </Field>
            <Field label="Matricule fiscal">
              <AInput
                value={editForm.taxId}
                onChange={(e) =>
                  setEditForm({ ...editForm, taxId: e.target.value })
                }
              />
            </Field>
            <Field label="Commercial">
              <AInput
                value={editForm.salesRep}
                onChange={(e) =>
                  setEditForm({ ...editForm, salesRep: e.target.value })
                }
              />
            </Field>
            <Field label="Conditions de paiement">
              <AInput
                value={editForm.paymentTerms}
                onChange={(e) =>
                  setEditForm({ ...editForm, paymentTerms: e.target.value })
                }
              />
            </Field>
            <Field label="Plafond crédit (TND)">
              <AInput
                className="a-mono"
                value={editForm.creditLimit}
                onChange={(e) =>
                  setEditForm({ ...editForm, creditLimit: e.target.value })
                }
                inputMode="decimal"
              />
            </Field>
            <Field label="Statut cycle de vie">
              <select
                className={softSelect}
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    status: e.target.value as CustomerStatus,
                  })
                }
              >
                {LIFECYCLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Zone">
              <select
                className={softSelect}
                value={editForm.zoneId}
                onChange={(e) =>
                  setEditForm({ ...editForm, zoneId: e.target.value })
                }
              >
                <option value="">— Aucune —</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.code} · {z.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="space-y-3 a-underlay p-3">
              <p className="text-[length:var(--a-text-sm)] font-medium">
                Salubrité
              </p>
              <ToggleRow
                label="Outlook"
                checked={editForm.salubritaEmail}
                onChange={(v) =>
                  setEditForm({ ...editForm, salubritaEmail: v })
                }
              />
              <ToggleRow
                label="WhatsApp"
                checked={editForm.salubritaWhatsapp}
                onChange={(v) =>
                  setEditForm({ ...editForm, salubritaWhatsapp: v })
                }
              />
              <ToggleRow
                label="Portail"
                checked={editForm.salubritaPortal}
                onChange={(v) =>
                  setEditForm({ ...editForm, salubritaPortal: v })
                }
              />
            </div>

            <FulfillmentDocToggle
              value={editForm.fulfillmentDoc}
              onChange={(fulfillmentDoc) =>
                setEditForm({ ...editForm, fulfillmentDoc })
              }
              hint="Titre imprimé (facture ou bon de livraison) — même contenu, même compta. Modifiable à chaque document."
            />

            <div className="space-y-3 a-underlay p-3">
              <p className="text-[length:var(--a-text-sm)] font-medium">
                Contrôle crédit
              </p>
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Toggles locaux — pas de barème inventé. Le blocage ops reste le
                flag Bloqué.
              </p>
              <ToggleRow
                label="Activer le contrôle"
                checked={editForm.enableCreditControl}
                onChange={(v) =>
                  setEditForm({ ...editForm, enableCreditControl: v })
                }
              />
              <ToggleRow
                label="Alerte avant plafond"
                checked={editForm.alertBeforeCreditLimit}
                onChange={(v) =>
                  setEditForm({ ...editForm, alertBeforeCreditLimit: v })
                }
              />
              <ToggleRow
                label="Bloquer au plafond"
                checked={editForm.blockOnCreditLimit}
                onChange={(v) =>
                  setEditForm({ ...editForm, blockOnCreditLimit: v })
                }
              />
              <ToggleRow
                label="Override exceptionnel"
                checked={editForm.allowExceptionalOverride}
                onChange={(v) =>
                  setEditForm({ ...editForm, allowExceptionalOverride: v })
                }
              />
              <ToggleRow
                label="Bloquer si échu critique"
                checked={editForm.blockOnCriticalOverdue}
                onChange={(v) =>
                  setEditForm({ ...editForm, blockOnCriticalOverdue: v })
                }
              />
              <ToggleRow
                label="Notifier le responsable"
                checked={editForm.notifyResponsible}
                onChange={(v) =>
                  setEditForm({ ...editForm, notifyResponsible: v })
                }
              />
            </div>

            {editError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {editError}
              </p>
            ) : null}
          </div>
        ) : null}
      </ADrawer>

      <ADrawer
        open={contactOpen}
        onOpenChange={setContactOpen}
        title="Nouveau contact"
        footer={
          <div className="flex justify-end gap-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setContactOpen(false)}
            >
              Annuler
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onAddContact()}
            >
              {busy ? "…" : "Ajouter"}
            </AButton>
          </div>
        }
      >
        <div className="space-y-3 p-4">
          <Field label="Nom">
            <AInput
              value={contactForm.name}
              onChange={(e) =>
                setContactForm({ ...contactForm, name: e.target.value })
              }
            />
          </Field>
          <Field label="Rôle">
            <AInput
              value={contactForm.role}
              onChange={(e) =>
                setContactForm({ ...contactForm, role: e.target.value })
              }
            />
          </Field>
          <Field label="Téléphone">
            <AInput
              value={contactForm.phone}
              onChange={(e) =>
                setContactForm({ ...contactForm, phone: e.target.value })
              }
            />
          </Field>
          <Field label="WhatsApp">
            <AInput
              value={contactForm.whatsapp}
              onChange={(e) =>
                setContactForm({ ...contactForm, whatsapp: e.target.value })
              }
            />
          </Field>
          <Field label="Email">
            <AInput
              value={contactForm.email}
              onChange={(e) =>
                setContactForm({ ...contactForm, email: e.target.value })
              }
            />
          </Field>
          <ToggleRow
            label="Contact principal"
            checked={contactForm.isPrimary}
            onChange={(v) => setContactForm({ ...contactForm, isPrimary: v })}
          />
          <ToggleRow
            label="Peut commander"
            checked={contactForm.canOrder}
            onChange={(v) => setContactForm({ ...contactForm, canOrder: v })}
          />
          <ToggleRow
            label="Reçoit factures"
            checked={contactForm.receiveInvoices}
            onChange={(v) =>
              setContactForm({ ...contactForm, receiveInvoices: v })
            }
          />
          <ToggleRow
            label="Accès portail (flag)"
            checked={contactForm.portalAccess}
            onChange={(v) =>
              setContactForm({ ...contactForm, portalAccess: v })
            }
          />
          {contactError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-danger">
              {contactError}
            </p>
          ) : null}
        </div>
      </ADrawer>

      <ADrawer
        open={addressOpen}
        onOpenChange={setAddressOpen}
        title="Nouvelle adresse"
        footer={
          <div className="flex justify-end gap-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setAddressOpen(false)}
            >
              Annuler
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onAddAddress()}
            >
              {busy ? "…" : "Ajouter"}
            </AButton>
          </div>
        }
      >
        <div className="space-y-3 p-4">
          <Field label="Type">
            <select
              className={softSelect}
              value={addressForm.type}
              onChange={(e) =>
                setAddressForm({
                  ...addressForm,
                  type: e.target.value as CustomerAddressType,
                })
              }
            >
              {ADDRESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ADDRESS_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Libellé">
            <AInput
              value={addressForm.label}
              onChange={(e) =>
                setAddressForm({ ...addressForm, label: e.target.value })
              }
            />
          </Field>
          <Field label="Ligne 1">
            <AInput
              value={addressForm.line1}
              onChange={(e) =>
                setAddressForm({ ...addressForm, line1: e.target.value })
              }
            />
          </Field>
          <Field label="Ligne 2">
            <AInput
              value={addressForm.line2}
              onChange={(e) =>
                setAddressForm({ ...addressForm, line2: e.target.value })
              }
            />
          </Field>
          <Field label="Ville">
            <AInput
              value={addressForm.city}
              onChange={(e) =>
                setAddressForm({ ...addressForm, city: e.target.value })
              }
            />
          </Field>
          <Field label="Gouvernorat">
            <AInput
              value={addressForm.governorate}
              onChange={(e) =>
                setAddressForm({
                  ...addressForm,
                  governorate: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Code postal">
            <AInput
              value={addressForm.postalCode}
              onChange={(e) =>
                setAddressForm({ ...addressForm, postalCode: e.target.value })
              }
            />
          </Field>
          <Field label="Contact site">
            <AInput
              value={addressForm.contactName}
              onChange={(e) =>
                setAddressForm({
                  ...addressForm,
                  contactName: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Tél. site">
            <AInput
              value={addressForm.contactPhone}
              onChange={(e) =>
                setAddressForm({
                  ...addressForm,
                  contactPhone: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Instructions">
            <AInput
              value={addressForm.instructions}
              onChange={(e) =>
                setAddressForm({
                  ...addressForm,
                  instructions: e.target.value,
                })
              }
            />
          </Field>
          <ToggleRow
            label="Adresse principale"
            checked={addressForm.isPrimary}
            onChange={(v) =>
              setAddressForm({ ...addressForm, isPrimary: v })
            }
          />
          {addressError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-danger">
              {addressError}
            </p>
          ) : null}
        </div>
      </ADrawer>

      <ADrawer
        open={portalOpen}
        onOpenChange={setPortalOpen}
        title="Lier utilisateur portail"
        description="Compte Identity de la société — pas de création ici."
        footer={
          <div className="flex justify-end gap-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPortalOpen(false)}
            >
              Annuler
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy || !portalUserId}
              onClick={() => void onLinkPortalUser()}
            >
              {busy ? "…" : "Lier"}
            </AButton>
          </div>
        }
      >
        <div className="space-y-3 p-4">
          <div className="flex gap-2">
            <AInput
              value={portalQ}
              onChange={(e) => setPortalQ(e.target.value)}
              placeholder="Rechercher e-mail ou nom"
              className="flex-1"
            />
            <AButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void searchLinkable()}
            >
              Filtrer
            </AButton>
          </div>
          <Field label="Utilisateur">
            <select
              className={softSelect}
              value={portalUserId}
              onChange={(e) => setPortalUserId(e.target.value)}
            >
              <option value="">— Choisir —</option>
              {linkable.map((u) => (
                <option
                  key={u.id}
                  value={u.id}
                  disabled={u.membershipStatus === "ACTIVE"}
                >
                  {u.displayName} · {u.email}
                  {u.membershipStatus === "ACTIVE"
                    ? " (déjà lié)"
                    : u.membershipStatus === "REVOKED"
                      ? " (révoqué — réactiver)"
                      : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rôle">
            <select
              className={softSelect}
              value={portalRole}
              onChange={(e) =>
                setPortalRole(e.target.value as PortalMembershipRole)
              }
            >
              {(
                Object.keys(PORTAL_ROLE_LABELS) as PortalMembershipRole[]
              ).map((r) => (
                <option key={r} value={r}>
                  {PORTAL_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </Field>
          {portalError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-danger">
              {portalError}
            </p>
          ) : null}
        </div>
      </ADrawer>
    </>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[length:var(--a-text-sm)] text-a-fg">{label}</span>
      <ASwitch size="sm" label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="a-underlay space-y-1 px-3 py-2">
      <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">{label}</p>
      <p className="a-mono text-[length:var(--a-text-lg)] font-medium">{value}</p>
    </div>
  );
}

function RecentList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    id: string;
    href: string;
    primary: string;
    secondary: string;
    amount: string | null;
  }>;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-[length:var(--a-text-sm)] font-medium text-a-fg-muted">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">—</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-baseline justify-between gap-2 text-[length:var(--a-text-sm)]"
            >
              <Link href={r.href} className="text-a-accent hover:underline">
                {r.primary}
              </Link>
              <span className="text-a-fg-muted">{r.secondary}</span>
              <span className="a-mono shrink-0">
                {r.amount ? money(r.amount) : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
