"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ABadge,
  AButton,
  ACombobox,
  ADrawer,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AFormSection,
  AInput,
  AListUtilities,
  APageBody,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  erpListDescription,
  type AComboboxOption,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { FulfillmentDocToggle } from "@/components/fulfillment-doc-toggle";
import {
  fetchWarehouses,
  type InventoryWarehouse,
} from "@/lib/inventory";
import {
  cancelSalesOrder,
  confirmSalesOrder,
  createSalesOrder,
  fetchIntakeSettings,
  fetchSalesOrders,
  searchCustomers,
  searchProducts,
  type SalesFulfillmentStatus,
  type SalesIntakeSettings,
  type SalesOrder,
  type SalesOrderStatus,
} from "@/lib/sales";
import {
  fetchCustomer,
  suggestCustomerPrice,
  updateCustomer,
  type FulfillmentDoc,
} from "@/lib/customers";
import { useStatusLabel } from "@/hooks/use-status-label";
import { ATabs } from "@/components/a/a-tabs";

const STATUS_FILTERS: { id: "" | SalesOrderStatus; label: string }[] = [
  { id: "", label: "Tout" },
  { id: "DRAFT", label: "Brouillon" },
  { id: "CONFIRMED", label: "Confirmée" },
  { id: "CANCELLED", label: "Annulée" },
];

function orderBadgeTone(
  status: SalesOrderStatus,
): "success" | "warning" | "neutral" {
  if (status === "CONFIRMED") return "success";
  if (status === "CANCELLED") return "warning";
  return "neutral";
}

function fulfillmentBadgeTone(
  status: SalesFulfillmentStatus,
): "success" | "accent" | "neutral" {
  if (status === "FULL") return "success";
  if (status === "PARTIAL") return "accent";
  return "neutral";
}

function fulfillmentLabel(status: SalesFulfillmentStatus): string {
  if (status === "FULL") return "Livré";
  if (status === "PARTIAL") return "Partiel";
  return "Non livré";
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: SalesOrder[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type LineDraft = {
  key: string;
  productId: string | null;
  productLabel: string;
  qty: string;
  unitPrice: string;
  discountPct: string;
};

type FormState = {
  customerId: string | null;
  customerLabel: string;
  customerVersion: number | null;
  customerLegalName: string;
  fulfillmentDoc: FulfillmentDoc;
  warehouseId: string | null;
  warehouseLabel: string;
  requestedDate: string;
  preferredDriver: string;
  notes: string;
  lines: LineDraft[];
};

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function newLine(): LineDraft {
  return {
    key: `l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: null,
    productLabel: "",
    qty: "1",
    unitPrice: "0",
    discountPct: "0",
  };
}

function lineNetTotal(qty: string, unitPrice: string, discountPct: string): number {
  const q = Number(qty.replace(",", "."));
  const p = Number(unitPrice.replace(",", "."));
  const d = Number(discountPct.replace(",", "."));
  if (!Number.isFinite(q) || !Number.isFinite(p) || !Number.isFinite(d)) return 0;
  return Math.round(q * p * (1 - Math.min(100, Math.max(0, d)) / 100) * 1000) / 1000;
}

function SalesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { label: st } = useStatusLabel();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | SalesOrderStatus>(() => {
    const s = searchParams.get("status");
    if (s === "DRAFT" || s === "CONFIRMED" || s === "CANCELLED") return s;
    return "";
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [settings, setSettings] = useState<SalesIntakeSettings | null>(null);

  const [customerOpts, setCustomerOpts] = useState<AComboboxOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [warehouseOpts, setWarehouseOpts] = useState<AComboboxOption[]>([]);
  const [productOptsByKey, setProductOptsByKey] = useState<
    Record<string, AComboboxOption[]>
  >({});
  const [productLoadingKey, setProductLoadingKey] = useState<string | null>(
    null,
  );
  const [pendingNew, setPendingNew] = useState(
    () => searchParams.get("new") === "1",
  );

  const load = useCallback(async (query?: string, status?: "" | SalesOrderStatus) => {
    setState({ kind: "loading" });
    const res = await fetchSalesOrders({
      q: query,
      status: status || undefined,
    });
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
    void load("", statusFilter);
    void (async () => {
      const [w, s] = await Promise.all([
        fetchWarehouses(),
        fetchIntakeSettings(),
      ]);
      if (w.ok) {
        setWarehouses(w.items);
        setWarehouseOpts(
          w.items.map((wh) => ({
            id: wh.id,
            label: `${wh.code} — ${wh.name}`,
          })),
        );
      }
      if (s.ok) setSettings(s.data);
    })();
    // initial hydrate only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  function syncStatusUrl(next: "" | SalesOrderStatus) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set("status", next);
    else sp.delete("status");
    const qs = sp.toString();
    router.replace(qs ? `/sales?${qs}` : "/sales", { scroll: false });
  }

  useEffect(() => {
    const s = searchParams.get("status");
    const next: "" | SalesOrderStatus =
      s === "DRAFT" || s === "CONFIRMED" || s === "CANCELLED" ? s : "";
    if (next !== statusFilter) {
      setStatusFilter(next);
      void load(q, next);
    }
    // sync from URL only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const refreshCustomers = useCallback((qText: string) => {
    setCustomerLoading(true);
    void searchCustomers(qText).then((res) => {
      setCustomerLoading(false);
      if (!res.ok) {
        setCustomerOpts([]);
        return;
      }
      setCustomerOpts(
        res.items.map((c) => ({
          id: c.id,
          label: c.nickname
            ? `${c.nickname} · ${c.code}`
            : `${c.code} — ${c.legalName}`,
          hint: c.nickname ? c.legalName : undefined,
        })),
      );
    });
  }, []);

  useEffect(() => {
    if (!form) return;
    const qCust = form.customerLabel.trim();
    const t = window.setTimeout(() => refreshCustomers(qCust), 150);
    return () => window.clearTimeout(t);
  }, [form?.customerLabel, form != null, refreshCustomers]);

  function searchProductForLine(lineKey: string, text: string) {
    setProductLoadingKey(lineKey);
    void searchProducts(text).then((res) => {
      setProductLoadingKey((k) => (k === lineKey ? null : k));
      if (!res.ok) {
        setProductOptsByKey((m) => ({ ...m, [lineKey]: [] }));
        return;
      }
      setProductOptsByKey((m) => ({
        ...m,
        [lineKey]: res.items.map((p) => ({
          id: p.id,
          label: `${p.sku} — ${p.name}`,
          hint: p.status,
        })),
      }));
    });
  }

  const openCreate = useCallback(() => {
    setFormError(null);
    const wh = warehouses[0];
    setForm({
      customerId: null,
      customerLabel: "",
      customerVersion: null,
      customerLegalName: "",
      fulfillmentDoc: "DELIVERY_NOTE",
      warehouseId: wh?.id ?? null,
      warehouseLabel: wh ? `${wh.code} — ${wh.name}` : "",
      requestedDate: todayIsoDate(),
      preferredDriver: "",
      notes: "",
      lines: [newLine()],
    });
    setCustomerOpts([]);
    setProductOptsByKey({});
    setDrawerOpen(true);
    refreshCustomers("");
  }, [warehouses, refreshCustomers]);

  useEffect(() => {
    if (!pendingNew) return;
    openCreate();
    setPendingNew(false);
    router.replace("/sales", { scroll: false });
  }, [pendingNew, openCreate, router]);

  async function submitCreate(confirmAfter: boolean) {
    if (!form) return;
    if (!form.customerId) {
      setFormError("Sélectionnez un client (saisie + proposition).");
      return;
    }
    if (!form.warehouseId) {
      setFormError("Entrepôt requis.");
      return;
    }
    if (settings?.requireRequestedDate && !form.requestedDate) {
      setFormError("Date demandée requise (paramètre société).");
      return;
    }
    const lines = [];
    for (const line of form.lines) {
      if (!line.productId) {
        setFormError("Chaque ligne doit avoir un produit sélectionné.");
        return;
      }
      const qty = Number(line.qty.replace(",", "."));
      const unitPrice = Number(line.unitPrice.replace(",", "."));
      const discountPct = Number(line.discountPct.replace(",", ".") || "0");
      if (!Number.isFinite(qty) || qty <= 0) {
        setFormError("Quantité invalide sur une ligne.");
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        setFormError("Prix invalide sur une ligne.");
        return;
      }
      if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) {
        setFormError("Remise % invalide (0–100) sur une ligne.");
        return;
      }
      lines.push({
        productId: line.productId,
        qty,
        unitPrice,
        discountPct: discountPct || undefined,
      });
    }
    if (lines.length === 0) {
      setFormError("Ajoutez au moins une ligne article.");
      return;
    }

    setBusy(true);
    setFormError(null);
    const res = await createSalesOrder({
      customerId: form.customerId,
      warehouseId: form.warehouseId,
      requestedDate: form.requestedDate || todayIsoDate(),
      preferredDriver: form.preferredDriver.trim() || undefined,
      notes: form.notes.trim() || undefined,
      lines,
      confirmAfter,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q, statusFilter);
    router.push(`/sales/${res.data.id}`);
  }

  async function onConfirm(row: SalesOrder) {
    const res = await confirmSalesOrder(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q, statusFilter);
  }

  async function onCancel(row: SalesOrder) {
    const res = await cancelSalesOrder(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q, statusFilter);
  }

  const workflowHint = settings
    ? [
        "Crédit (Prefs)",
        "Prix",
        settings.reserveOnConfirm ? "Stock → réserve" : "Stock (réserve off)",
        "Confirmé + events",
      ].join(" → ")
    : "Crédit → prix → stock → réserve → confirm";

  const recordCount = state.kind === "ok" ? state.items.length : null;

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/" className="hover:text-a-fg">
            Ventes
          </Link>
        }
        title="Commandes"
        description={erpListDescription(
          recordCount,
          workflowHint,
        )}
        primary={
          <AButton type="button" size="sm" onClick={openCreate}>
            {LAYOUT_ACTIONS.newOrder}
          </AButton>
        }
      />
      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="so-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher commandes, clients, références…"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q, statusFilter);
              }}
            />
          }
          filters={
            <ATabs
              ariaLabel="Filtrer par statut"
              value={statusFilter || "all"}
              onValueChange={(id) => {
                const next = (id === "all" ? "" : id) as "" | SalesOrderStatus;
                setStatusFilter(next);
                syncStatusUrl(next);
                void load(q, next);
              }}
              items={STATUS_FILTERS.map((chip) => ({
                id: chip.id || "all",
                label: chip.label,
              }))}
            />
          }
          utilities={
            <AListUtilities
              onFilter={() => void load(q, statusFilter)}
            />
          }
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
            onRetry={() => void load(q, statusFilter)}
          />
        ) : null}

        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucune commande"
            description="Saisissez le surnom ou le code client, ajoutez plusieurs articles, puis confirmez."
            actionLabel={LAYOUT_ACTIONS.newOrder}
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <ASoftTable className="min-w-[52rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>Commande</ASoftTh>
                <ASoftTh>Client</ASoftTh>
                <ASoftTh>Date</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
                <ASoftTh numeric>Montant</ASoftTh>
                <ASoftTh>Livraison</ASoftTh>
                <ASoftTh>Actions</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((row) => (
                <ASoftTr
                  key={row.id}
                  onClick={() => router.push(`/sales/${row.id}`)}
                >
                  <ASoftTd>
                    <Link
                      href={`/sales/${row.id}`}
                      className="a-mono font-medium text-a-accent hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.number}
                    </Link>
                  </ASoftTd>
                  <ASoftTd>
                    {row.customerName ?? row.customerCode ?? "—"}
                  </ASoftTd>
                  <ASoftTd className="a-mono text-a-fg-muted">
                    {row.requestedDate
                      ? row.requestedDate.slice(0, 10)
                      : row.createdAt.slice(0, 10)}
                  </ASoftTd>
                  <ASoftTd>
                    <ABadge tone={orderBadgeTone(row.status)}>
                      {st(row.status)}
                    </ABadge>
                  </ASoftTd>
                  <ASoftTd numeric className="a-mono a-tabular">
                    {row.amountTotal}{" "}
                    <span className="text-a-fg-subtle">{row.currency}</span>
                  </ASoftTd>
                  <ASoftTd>
                    {row.status === "CONFIRMED" && row.fulfillmentStatus ? (
                      <ABadge
                        tone={fulfillmentBadgeTone(row.fulfillmentStatus)}
                      >
                        {fulfillmentLabel(row.fulfillmentStatus)}
                      </ABadge>
                    ) : (
                      <span className="text-a-fg-subtle">—</span>
                    )}
                  </ASoftTd>
                  <ASoftTd>
                    <div
                      className="flex flex-wrap gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.status === "DRAFT" ? (
                        <AButton
                          type="button"
                          size="sm"
                          onClick={() => void onConfirm(row)}
                        >
                          Confirmer
                        </AButton>
                      ) : null}
                      {row.status !== "CANCELLED" ? (
                        <AButton
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => void onCancel(row)}
                        >
                          Annuler
                        </AButton>
                      ) : null}
                    </div>
                  </ASoftTd>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        ) : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Prise de commande"
        description="Autocomplete client (surnom) · multi-articles · workflow confirm"
        className="max-w-xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setDrawerOpen(false)}
            >
              Fermer
            </AButton>
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || !form}
              onClick={() => void submitCreate(false)}
            >
              {busy ? "…" : "Brouillon"}
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy || !form}
              onClick={() => void submitCreate(true)}
            >
              {busy ? "…" : "Enregistrer et confirmer"}
            </AButton>
          </div>
        }
      >
        {form ? (
          <div className="space-y-5">
            <p className="rounded-[var(--a-radius-sm)] bg-a-surface-3/80 px-3 py-2 text-[12px] text-a-fg-muted">
              Workflow auto à la confirmation : {workflowHint}
              {settings?.autoConfirmOnCreate
                ? " · auto_confirm_on_create=ON"
                : ""}
            </p>

            <AFormSection title="Client & document">
            <ACombobox
              label="Client (surnom, code ou raison sociale)"
              valueId={form.customerId}
              displayValue={form.customerLabel}
              onDisplayChange={(text) =>
                setForm({
                  ...form,
                  customerLabel: text,
                  customerId: null,
                  customerVersion: null,
                  customerLegalName: "",
                  fulfillmentDoc: "DELIVERY_NOTE",
                })
              }
              onSelect={(opt) => {
                setForm({
                  ...form,
                  customerId: opt.id,
                  customerLabel: opt.label,
                  customerVersion: null,
                  customerLegalName: opt.label,
                  fulfillmentDoc: "DELIVERY_NOTE",
                });
                void fetchCustomer(opt.id).then((detail) => {
                  if (!detail.ok) return;
                  setForm((prev) =>
                    prev && prev.customerId === opt.id
                      ? {
                          ...prev,
                          customerVersion: detail.data.version,
                          customerLegalName: detail.data.legalName,
                          fulfillmentDoc:
                            detail.data.fulfillmentDoc ?? "DELIVERY_NOTE",
                        }
                      : prev,
                  );
                });
              }}
              onOpen={() => refreshCustomers(form.customerLabel.trim())}
              options={customerOpts}
              loading={customerLoading}
              placeholder="Ex. Atlas, C-001…"
              emptyText="Aucun client — créez-en un ou affinez la saisie"
            />

            {form.customerId ? (
              <FulfillmentDocToggle
                value={form.fulfillmentDoc}
                onChange={(fulfillmentDoc) => {
                  setForm({ ...form, fulfillmentDoc });
                  if (
                    form.customerId &&
                    form.customerVersion != null &&
                    form.customerLegalName
                  ) {
                    void updateCustomer(form.customerId, {
                      legalName: form.customerLegalName,
                      fulfillmentDoc,
                      version: form.customerVersion,
                    }).then((res) => {
                      if (!res.ok) {
                        setFormError(res.message);
                        return;
                      }
                      setForm((prev) =>
                        prev && prev.customerId === form.customerId
                          ? {
                              ...prev,
                              fulfillmentDoc:
                                res.data.fulfillmentDoc ?? fulfillmentDoc,
                              customerVersion: res.data.version,
                            }
                          : prev,
                      );
                    });
                  }
                }}
                hint="Préférence client (BL ou facture) — enregistrée sur la fiche, utilisée à la facturation."
              />
            ) : null}
            </AFormSection>

            <AFormSection title="Expédition">
            <ACombobox
              label="Entrepôt (réserve stock)"
              valueId={form.warehouseId}
              displayValue={form.warehouseLabel}
              onDisplayChange={(text) => {
                setForm({
                  ...form,
                  warehouseLabel: text,
                  warehouseId: null,
                });
                const q = text.trim().toLowerCase();
                setWarehouseOpts(
                  warehouses
                    .filter(
                      (w) =>
                        !q ||
                        w.code.toLowerCase().includes(q) ||
                        w.name.toLowerCase().includes(q),
                    )
                    .map((w) => ({
                      id: w.id,
                      label: `${w.code} — ${w.name}`,
                    })),
                );
              }}
              onSelect={(opt) =>
                setForm({
                  ...form,
                  warehouseId: opt.id,
                  warehouseLabel: opt.label,
                })
              }
              onOpen={() =>
                setWarehouseOpts(
                  warehouses.map((w) => ({
                    id: w.id,
                    label: `${w.code} — ${w.name}`,
                  })),
                )
              }
              options={warehouseOpts}
              placeholder="MAIN…"
              emptyText="Aucun entrepôt"
            />

            <div className="space-y-1">
              <label className="a-field-label">
                Date demandée
                {settings?.requireRequestedDate ? (
                  <span className="text-a-accent" aria-hidden>
                    *
                  </span>
                ) : null}
              </label>
              <AInput
                type="date"
                value={form.requestedDate}
                onChange={(e) =>
                  setForm({ ...form, requestedDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-1">
              <label className="a-field-label">Livreur souhaité</label>
              <AInput
                value={form.preferredDriver}
                onChange={(e) =>
                  setForm({ ...form, preferredDriver: e.target.value })
                }
                placeholder="Nom libre — assignation tournée = module Delivery"
              />
              <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                Hint pour la préparation. L’affectation véhicule/chauffeur réelle
                est portée par Delivery (phase suivante).
              </p>
            </div>
            </AFormSection>

            <AFormSection
              title="Articles"
              description="Multi-lignes · prix client suggéré si tarif fiche"
            >
              <div className="flex items-center justify-end">
                <AButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setForm({ ...form, lines: [...form.lines, newLine()] })
                  }
                >
                  + Ligne
                </AButton>
              </div>

              {form.lines.map((line, idx) => (
                <div
                  key={line.key}
                  className="space-y-2 rounded-[var(--a-radius-sm)] bg-a-surface-3/60 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                      Ligne {idx + 1}
                    </span>
                    {form.lines.length > 1 ? (
                      <AButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setForm({
                            ...form,
                            lines: form.lines.filter((l) => l.key !== line.key),
                          })
                        }
                      >
                        Retirer
                      </AButton>
                    ) : null}
                  </div>
                  <ACombobox
                    label="Produit"
                    valueId={line.productId}
                    displayValue={line.productLabel}
                    onDisplayChange={(text) => {
                      setForm({
                        ...form,
                        lines: form.lines.map((l) =>
                          l.key === line.key
                            ? { ...l, productLabel: text, productId: null }
                            : l,
                        ),
                      });
                      searchProductForLine(line.key, text);
                    }}
                    onSelect={(opt) => {
                      const customerId = form.customerId;
                      setForm({
                        ...form,
                        lines: form.lines.map((l) =>
                          l.key === line.key
                            ? {
                                ...l,
                                productId: opt.id,
                                productLabel: opt.label,
                              }
                            : l,
                        ),
                      });
                      if (customerId) {
                        void suggestCustomerPrice(customerId, opt.id).then(
                          (res) => {
                            if (!res.ok || !res.data.unitPrice) return;
                            const price = res.data.unitPrice;
                            setForm((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    lines: prev.lines.map((l) =>
                                      l.key === line.key
                                        ? { ...l, unitPrice: price }
                                        : l,
                                    ),
                                  }
                                : prev,
                            );
                          },
                        );
                      }
                    }}
                    onOpen={() =>
                      searchProductForLine(line.key, line.productLabel)
                    }
                    options={productOptsByKey[line.key] ?? []}
                    loading={productLoadingKey === line.key}
                    placeholder="SKU ou nom…"
                    emptyText="Aucun produit — activez un article dans Catalogue"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="a-field-label">Qté</label>
                      <AInput
                        value={line.qty}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            lines: form.lines.map((l) =>
                              l.key === line.key
                                ? { ...l, qty: e.target.value }
                                : l,
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="a-field-label">Prix u.</label>
                      <AInput
                        value={line.unitPrice}
                        disabled={settings?.allowManualPrice === false}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            lines: form.lines.map((l) =>
                              l.key === line.key
                                ? { ...l, unitPrice: e.target.value }
                                : l,
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="a-field-label">Remise %</label>
                      <AInput
                        value={line.discountPct}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            lines: form.lines.map((l) =>
                              l.key === line.key
                                ? { ...l, discountPct: e.target.value }
                                : l,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                  <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Net ligne :{" "}
                    {lineNetTotal(line.qty, line.unitPrice, line.discountPct).toFixed(3)}
                  </p>
                </div>
              ))}
            </AFormSection>

            <AFormSection title="Notes">
              <AInput
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </AFormSection>

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

export default function SalesPage() {
  return (
    <Suspense
      fallback={
        <APageBody>
          <ASkeleton className="h-10 w-48" />
          <ASkeleton className="h-10 w-full" />
        </APageBody>
      }
    >
      <SalesPageInner />
    </Suspense>
  );
}
