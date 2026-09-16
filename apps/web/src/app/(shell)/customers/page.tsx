"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AInput,
  AListUtilities,
  APageBody,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftThead,
  ASoftTr,
  ASwitch,
  erpListDescription,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { FulfillmentDocToggle } from "@/components/fulfillment-doc-toggle";
import {
  STATUS_LABELS,
  addCustomerContact,
  archiveCustomer,
  blockCustomer,
  createCustomer,
  deleteCustomerPrice,
  fetchCustomer,
  fetchCustomerZones,
  fetchCustomers,
  setCustomerCredit,
  unblockCustomer,
  updateCustomer,
  upsertCustomerPrice,
  type Customer,
  type CustomerPrice,
  type CustomerZone,
  type FulfillmentDoc,
} from "@/lib/customers";
import {
  fetchCustomerFinancialOverview,
  type CustomerFinancialOverview,
} from "@/lib/finance";
import { softSelect } from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: Customer[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FormState = {
  code: string;
  legalName: string;
  nickname: string;
  taxId: string;
  salesRep: string;
  paymentTerms: string;
  creditLimit: string;
  zoneId: string;
  salubritaEmail: boolean;
  salubritaWhatsapp: boolean;
  salubritaPortal: boolean;
  fulfillmentDoc: FulfillmentDoc;
  contactName: string;
  contactPhone: string;
  contactWhatsapp: string;
  contactEmail: string;
};

export default function CustomersPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [zones, setZones] = useState<CustomerZone[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [priceProductId, setPriceProductId] = useState("");
  const [priceHt, setPriceHt] = useState("");
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceProducts, setPriceProducts] = useState<
    Array<{ id: string; sku: string; name: string }>
  >([]);
  const [financeHub, setFinanceHub] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; data: CustomerFinancialOverview }
    | { kind: "forbidden" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const emptyForm = useCallback(
    (): FormState => ({
      code: "",
      legalName: "",
      nickname: "",
      taxId: "",
      salesRep: "",
      paymentTerms: "",
      creditLimit: "",
      zoneId: "",
      salubritaEmail: false,
      salubritaWhatsapp: false,
      salubritaPortal: true,
      fulfillmentDoc: "DELIVERY_NOTE",
      contactName: "",
      contactPhone: "",
      contactWhatsapp: "",
      contactEmail: "",
    }),
    [],
  );

  const loadZones = useCallback(async () => {
    const res = await fetchCustomerZones();
    if (res.ok) setZones(res.data);
  }, []);

  const loadPriceProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/products", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: Array<{ id: string; sku: string; name: string; status?: string }>;
      };
      setPriceProducts(
        data.items
          .filter((p) => !p.status || p.status === "ACTIVE" || p.status === "DRAFT")
          .map((p) => ({ id: p.id, sku: p.sku, name: p.name })),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const res = await fetchCustomers(query);
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
    void loadZones();
  }, [load, loadZones]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setFinanceHub({ kind: "idle" });
    setDrawerOpen(true);
  }

  async function openEdit(row: Customer) {
    setFormError(null);
    setPriceProductId("");
    setPriceHt("");
    setFinanceHub({ kind: "loading" });
    void loadPriceProducts();
    const detail = await fetchCustomer(row.id);
    if (!detail.ok) {
      setState({ kind: "error", message: detail.message });
      return;
    }
    setEditing(detail.data);
    setForm({
      code: detail.data.code,
      legalName: detail.data.legalName,
      nickname: detail.data.nickname ?? "",
      taxId: detail.data.taxId ?? "",
      salesRep: detail.data.salesRep ?? "",
      paymentTerms: detail.data.paymentTerms ?? "",
      creditLimit: detail.data.creditLimit ?? "",
      zoneId: detail.data.zoneId ?? "",
      salubritaEmail: detail.data.salubritaEmail ?? false,
      salubritaWhatsapp: detail.data.salubritaWhatsapp ?? false,
      salubritaPortal: detail.data.salubritaPortal ?? true,
      fulfillmentDoc: detail.data.fulfillmentDoc ?? "DELIVERY_NOTE",
      contactName: "",
      contactPhone: "",
      contactWhatsapp: "",
      contactEmail: "",
    });
    setDrawerOpen(true);
    const hub = await fetchCustomerFinancialOverview(row.id);
    if (hub.ok) setFinanceHub({ kind: "ok", data: hub.data });
    else if (hub.status === 403) setFinanceHub({ kind: "forbidden" });
    else setFinanceHub({ kind: "error", message: hub.message });
  }

  async function onSave() {
    if (!form) return;
    setBusy(true);
    setFormError(null);
    try {
      const zoneId = form.zoneId.trim() || null;
      const creditLimit = form.creditLimit.trim() || undefined;

      if (!editing) {
        const contacts =
          form.contactName.trim().length > 0
            ? [
                {
                  name: form.contactName.trim(),
                  phone: form.contactPhone.trim() || undefined,
                  whatsapp: form.contactWhatsapp.trim() || undefined,
                  email: form.contactEmail.trim() || undefined,
                },
              ]
            : undefined;
        const res = await createCustomer({
          code: form.code.trim(),
          legalName: form.legalName.trim(),
          nickname: form.nickname.trim() || undefined,
          taxId: form.taxId.trim() || undefined,
          salesRep: form.salesRep.trim() || undefined,
          paymentTerms: form.paymentTerms.trim() || undefined,
          creditLimit,
          zoneId,
          salubritaEmail: form.salubritaEmail,
          salubritaWhatsapp: form.salubritaWhatsapp,
          salubritaPortal: form.salubritaPortal,
          fulfillmentDoc: form.fulfillmentDoc,
          contacts,
        });
        if (!res.ok) {
          setFormError(res.message);
          return;
        }
      } else {
        let version = editing.version;
        const res = await updateCustomer(editing.id, {
          legalName: form.legalName.trim(),
          nickname: form.nickname.trim() || undefined,
          taxId: form.taxId.trim() || undefined,
          salesRep: form.salesRep.trim() || undefined,
          paymentTerms: form.paymentTerms.trim() || undefined,
          zoneId,
          salubritaEmail: form.salubritaEmail,
          salubritaWhatsapp: form.salubritaWhatsapp,
          salubritaPortal: form.salubritaPortal,
          fulfillmentDoc: form.fulfillmentDoc,
          version,
        });
        if (!res.ok) {
          setFormError(res.message);
          return;
        }
        version = res.data.version;

        const nextCredit = form.creditLimit.trim();
        const prevCredit = editing.creditLimit ?? "";
        if (nextCredit !== prevCredit && nextCredit.length > 0) {
          const creditRes = await setCustomerCredit(editing.id, {
            creditLimit: nextCredit,
            version,
          });
          if (!creditRes.ok) {
            setFormError(creditRes.message);
            return;
          }
          version = creditRes.data.version;
          setEditing(creditRes.data);
        } else {
          setEditing(res.data);
        }

        if (form.contactName.trim()) {
          const contactRes = await addCustomerContact(editing.id, {
            name: form.contactName.trim(),
            phone: form.contactPhone.trim() || undefined,
            whatsapp: form.contactWhatsapp.trim() || undefined,
            email: form.contactEmail.trim() || undefined,
          });
          if (!contactRes.ok) {
            setFormError(contactRes.message);
            return;
          }
        }
      }
      setDrawerOpen(false);
      await load(q);
    } finally {
      setBusy(false);
    }
  }

  async function onArchive(row: Customer) {
    const res = await archiveCustomer(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  async function onToggleBlock() {
    if (!editing || !form) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = editing.blocked
        ? await unblockCustomer(editing.id, { version: editing.version })
        : await blockCustomer(editing.id, {
            reason: "Bloqué depuis fiche client",
            version: editing.version,
          });
      if (!res.ok) {
        setFormError(res.message);
        return;
      }
      setEditing(res.data);
      await load(q);
    } finally {
      setBusy(false);
    }
  }

  async function onSavePrice() {
    if (!editing) return;
    const ht = Number(priceHt.replace(",", "."));
    if (!priceProductId || !Number.isFinite(ht) || ht < 0) {
      setFormError("Tarif : produit et prix HT ≥ 0 requis.");
      return;
    }
    setPriceBusy(true);
    setFormError(null);
    const res = await upsertCustomerPrice(editing.id, {
      productId: priceProductId,
      unitPriceHt: ht,
    });
    setPriceBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    const detail = await fetchCustomer(editing.id);
    if (detail.ok) setEditing(detail.data);
    setPriceProductId("");
    setPriceHt("");
  }

  async function onDeletePrice(productId: string) {
    if (!editing) return;
    setPriceBusy(true);
    setFormError(null);
    const res = await deleteCustomerPrice(editing.id, productId);
    setPriceBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    const detail = await fetchCustomer(editing.id);
    if (detail.ok) setEditing(detail.data);
  }

  return (
    <>
      <AScreenHeader
        title="Clients"
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "fiches party · contacts · zones · crédit",
        )}
        primary={
          <AButton type="button" size="sm" onClick={openCreate}>
            {LAYOUT_ACTIONS.newCustomer}
          </AButton>
        }
      />
      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="cus-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher code, surnom, raison sociale…"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q);
              }}
            />
          }
          utilities={<AListUtilities onFilter={() => void load(q)} />}
        />

        {state.kind === "loading" ? (
          <div className="space-y-2">
            <ASkeleton className="h-10 w-full" />
            <ASkeleton className="h-10 w-full" />
          </div>
        ) : null}

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

        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun client"
            description="Créez la première fiche client."
            actionLabel={LAYOUT_ACTIONS.newCustomer}
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <ASoftTable className="min-w-[44rem]">
            <ASoftThead>
              <tr>
                <th className="a-table-cell font-medium">Code</th>
                <th className="a-table-cell font-medium">Surnom</th>
                <th className="a-table-cell font-medium">Raison sociale</th>
                <th className="a-table-cell font-medium">Zone</th>
                <th className="a-table-cell font-medium">Crédit</th>
                <th className="a-table-cell font-medium">Statut</th>
                <th className="a-table-cell font-medium">Actions</th>
              </tr>
            </ASoftThead>
            <tbody>
              {state.items.map((row) => (
                <ASoftTr key={row.id}>
                    <td className="a-mono a-table-cell">
                      <Link
                        href={`/customers/${row.id}`}
                        className="text-a-accent hover:underline"
                      >
                        {row.code}
                      </Link>
                    </td>
                    <td className="a-table-cell text-a-fg-muted">
                      {row.nickname ?? "—"}
                    </td>
                    <td className="a-table-cell">{row.legalName}</td>
                    <td className="a-table-cell text-a-fg-muted">
                      {row.zoneCode ?? "—"}
                    </td>
                    <td className="a-mono a-table-cell">
                      {row.creditLimit ?? "—"}
                    </td>
                    <td className="a-table-cell">
                      {row.blocked ? (
                        <ABadge tone="danger">Bloqué</ABadge>
                      ) : (
                        <ABadge tone="success">
                          {STATUS_LABELS[row.status]}
                        </ABadge>
                      )}
                    </td>
                    <td className="a-table-cell">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/customers/${row.id}`}
                          className="inline-flex items-center rounded-[var(--a-radius-sm)] px-2.5 py-1 text-[length:var(--a-text-sm)] text-a-accent underline-offset-4 hover:underline"
                        >
                          Fiche
                        </Link>
                        <AButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void openEdit(row)}
                        >
                          Éditer
                        </AButton>
                        <AButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void onArchive(row)}
                        >
                          Archiver
                        </AButton>
                      </div>
                    </td>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        ) : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={editing ? "Éditer client" : "Nouveau client"}
        description="Party master data + contacts, zone et crédit"
        footer={
          <div className="flex flex-wrap justify-between gap-2">
            {editing ? (
              <AButton
                type="button"
                variant={editing.blocked ? "secondary" : "ghost"}
                size="sm"
                disabled={busy}
                onClick={() => void onToggleBlock()}
              >
                {editing.blocked ? "Débloquer" : "Bloquer"}
              </AButton>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDrawerOpen(false)}
              >
                Annuler
              </AButton>
              <AButton
                type="button"
                size="sm"
                disabled={busy || !form}
                onClick={() => void onSave()}
              >
                {busy ? "…" : "Enregistrer"}
              </AButton>
            </div>
          </div>
        }
      >
        {form ? (
          <div className="space-y-4 p-4">
            {!editing ? (
              <Field label="Code">
                <AInput
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value })
                  }
                />
              </Field>
            ) : null}
            <Field label="Raison sociale">
              <AInput
                value={form.legalName}
                onChange={(e) =>
                  setForm({ ...form, legalName: e.target.value })
                }
              />
            </Field>
            <Field label="Surnom (prise de commande)">
              <AInput
                value={form.nickname}
                onChange={(e) =>
                  setForm({ ...form, nickname: e.target.value })
                }
                placeholder="Ex. Atlas"
              />
            </Field>
            <Field label="Matricule fiscal">
              <AInput
                value={form.taxId}
                onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              />
            </Field>
            <Field label="Commercial">
              <AInput
                value={form.salesRep}
                onChange={(e) =>
                  setForm({ ...form, salesRep: e.target.value })
                }
              />
            </Field>
            <Field label="Conditions de paiement">
              <AInput
                value={form.paymentTerms}
                onChange={(e) =>
                  setForm({ ...form, paymentTerms: e.target.value })
                }
              />
            </Field>
            <Field label="Plafond crédit (TND)">
              <AInput
                className="a-mono"
                value={form.creditLimit}
                onChange={(e) =>
                  setForm({ ...form, creditLimit: e.target.value })
                }
                placeholder="Ex. 5000.000"
                inputMode="decimal"
              />
            </Field>

            {editing ? (
              <div className="a-underlay space-y-3 rounded-md p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                    Hub financier
                  </p>
                  <Link
                    href="/finance"
                    className="text-[length:var(--a-text-xs)] font-medium text-a-accent hover:underline"
                  >
                    Ouvrir Finance →
                  </Link>
                </div>
                {financeHub.kind === "loading" ? (
                  <ASkeleton className="h-16 w-full" />
                ) : null}
                {financeHub.kind === "forbidden" ? (
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Finance non accessible (`finance.ar.read`).
                  </p>
                ) : null}
                {financeHub.kind === "error" ? (
                  <p className="text-[length:var(--a-text-xs)] text-a-danger">
                    {financeHub.message}
                  </p>
                ) : null}
                {financeHub.kind === "ok" ? (
                  <>
                    {financeHub.data.creditPressure?.level === "warn" ||
                    financeHub.data.creditPressure?.level === "breach" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <ABadge
                          tone={
                            financeHub.data.creditPressure.level === "breach"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {financeHub.data.creditPressure.level === "breach"
                            ? "Crédit dépassé"
                            : "Pression crédit"}
                        </ABadge>
                        <span className="a-mono text-[11px] text-a-fg-muted">
                          {financeHub.data.creditPressure.ratio != null
                            ? `${Math.round(financeHub.data.creditPressure.ratio * 100)}%`
                            : "—"}{" "}
                          du plafond · seuil{" "}
                          {Math.round(
                            financeHub.data.creditPressure.warnRatio * 100,
                          )}
                          %
                        </span>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div>
                        <p className="text-[10px] text-a-fg-muted">Encours</p>
                        <p className="a-mono text-[length:var(--a-text-sm)] tabular-nums">
                          {financeHub.data.credit.outstandingBalance}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-a-fg-muted">Échu</p>
                        <p className="a-mono text-[length:var(--a-text-sm)] tabular-nums">
                          {financeHub.data.aging.overdueTotal}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-a-fg-muted">Disponible</p>
                        <p className="a-mono text-[length:var(--a-text-sm)] tabular-nums">
                          {financeHub.data.availableCredit ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-a-fg-muted">Ouverts</p>
                        <p className="a-mono text-[length:var(--a-text-sm)] tabular-nums">
                          {financeHub.data.openCount}
                          {financeHub.data.overdueCount > 0
                            ? ` · ${financeHub.data.overdueCount} éch.`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                      {financeHub.data.aging.buckets.map((b) => (
                        <div
                          key={b.key}
                          className="rounded-md bg-a-surface-3 px-2 py-1.5"
                        >
                          <p className="text-[10px] text-a-fg-muted">{b.label}</p>
                          <p className="a-mono text-[11px] tabular-nums text-a-fg">
                            {b.amountOpen}
                          </p>
                          <p className="text-[10px] text-a-fg-subtle">
                            {b.count} créance{b.count === 1 ? "" : "s"}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-a-fg-subtle">
                      Aging au {financeHub.data.aging.asOf} · TND as-recorded ·
                      source Finance (pas de doublon customers)
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}

            <FulfillmentDocToggle
              value={form.fulfillmentDoc}
              onChange={(fulfillmentDoc) =>
                setForm({ ...form, fulfillmentDoc })
              }
              hint="Titre imprimé — même contenu, même compta. Défaut : bon de livraison."
            />

            <Field label="Zone">
              <select
                className={softSelect}
                value={form.zoneId}
                onChange={(e) =>
                  setForm({ ...form, zoneId: e.target.value })
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

            <div className="space-y-3 rounded-[var(--a-radius-sm)] bg-a-surface-3 p-3">
              <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                Certificat de salubrité
              </p>
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Canaux d’envoi depuis Stock → Certificat. Contacts e-mail /
                WhatsApp ci-dessous.
              </p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[length:var(--a-text-sm)] text-a-fg">
                  Outlook
                </span>
                <ASwitch
                  size="sm"
                  label="Outlook salubrité"
                  checked={form.salubritaEmail}
                  onCheckedChange={(v) =>
                    setForm({ ...form, salubritaEmail: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[length:var(--a-text-sm)] text-a-fg">
                  WhatsApp
                </span>
                <ASwitch
                  size="sm"
                  label="WhatsApp salubrité"
                  checked={form.salubritaWhatsapp}
                  onCheckedChange={(v) =>
                    setForm({ ...form, salubritaWhatsapp: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[length:var(--a-text-sm)] text-a-fg">
                  Portail client
                </span>
                <ASwitch
                  size="sm"
                  label="Portail salubrité"
                  checked={form.salubritaPortal}
                  onCheckedChange={(v) =>
                    setForm({ ...form, salubritaPortal: v })
                  }
                />
              </div>
            </div>

            {editing?.blocked ? (
              <p className="text-[length:var(--a-text-sm)] text-[color:var(--a-danger)]">
                Client bloqué
                {editing.blockedReason ? ` — ${editing.blockedReason}` : ""}
              </p>
            ) : null}

            {editing ? (
              <div className="a-underlay space-y-3 rounded-md p-3">
                <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                  Tarifs négociés (HT TND)
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Priorité portail / suggestion ADV — avant dernier prix
                  commande.
                </p>
                {(editing.prices ?? []).length > 0 ? (
                  <ul className="space-y-1.5 text-[length:var(--a-text-sm)]">
                    {(editing.prices as CustomerPrice[]).map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-2"
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
                ) : (
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                    Aucun tarif agréé.
                  </p>
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
              </div>
            ) : null}

            <div className="border-t border-white/5 pt-4">
              <p className="mb-3 text-[length:var(--a-text-sm)] text-a-fg-muted">
                {editing
                  ? "Ajouter un contact"
                  : "Contact initial (optionnel)"}
              </p>
              <div className="space-y-3">
                <Field label="Nom contact">
                  <AInput
                    value={form.contactName}
                    onChange={(e) =>
                      setForm({ ...form, contactName: e.target.value })
                    }
                  />
                </Field>
                <Field label="Téléphone">
                  <AInput
                    value={form.contactPhone}
                    onChange={(e) =>
                      setForm({ ...form, contactPhone: e.target.value })
                    }
                  />
                </Field>
                <Field label="WhatsApp">
                  <AInput
                    value={form.contactWhatsapp}
                    onChange={(e) =>
                      setForm({ ...form, contactWhatsapp: e.target.value })
                    }
                    placeholder="Ex. 216XXXXXXXX"
                  />
                </Field>
                <Field label="Email">
                  <AInput
                    value={form.contactEmail}
                    onChange={(e) =>
                      setForm({ ...form, contactEmail: e.target.value })
                    }
                  />
                </Field>
              </div>
            </div>

            {editing?.contacts && editing.contacts.length > 0 ? (
              <div className="space-y-1 text-[length:var(--a-text-sm)]">
                <p className="text-a-fg-muted">Contacts existants</p>
                {editing.contacts.map((c) => (
                  <p key={c.id} className="text-a-fg">
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ""}
                    {c.whatsapp ? ` · WA ${c.whatsapp}` : ""}
                    {c.email ? ` · ${c.email}` : ""}
                  </p>
                ))}
              </div>
            ) : null}

            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-[color:var(--a-danger)]">
                {formError}
              </p>
            ) : null}
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
