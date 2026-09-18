"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { ATabs } from "@/components/a/a-tabs";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import {
  fetchWarehouses,
  type InventoryWarehouse,
} from "@/lib/inventory";
import {
  searchCustomers,
  searchProducts,
} from "@/lib/sales";
import { suggestCustomerPrice } from "@/lib/customers";
import {
  createSalesQuote,
  fetchSalesQuotes,
  QUOTE_STATUS_LABELS,
  type SalesQuote,
  type SalesQuoteStatus,
} from "@/lib/sales-quotes";

const STATUS_FILTERS: { id: "" | SalesQuoteStatus; label: string }[] = [
  { id: "", label: "Tout" },
  { id: "DRAFT", label: "Brouillon" },
  { id: "SENT", label: "Envoyé" },
  { id: "ACCEPTED", label: "Accepté" },
  { id: "CANCELLED", label: "Annulé" },
];

function quoteBadgeTone(
  status: SalesQuoteStatus,
): "success" | "warning" | "accent" | "neutral" {
  if (status === "ACCEPTED") return "success";
  if (status === "SENT") return "accent";
  if (status === "CANCELLED" || status === "EXPIRED") return "warning";
  return "neutral";
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: SalesQuote[] }
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
  warehouseId: string | null;
  warehouseLabel: string;
  validUntil: string;
  notes: string;
  lines: LineDraft[];
};

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

function QuotesPageInner() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | SalesQuoteStatus>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [customerOpts, setCustomerOpts] = useState<AComboboxOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [productOptsByKey, setProductOptsByKey] = useState<
    Record<string, AComboboxOption[]>
  >({});
  const [productLoadingKey, setProductLoadingKey] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState<FormState>({
    customerId: null,
    customerLabel: "",
    warehouseId: null,
    warehouseLabel: "",
    validUntil: "",
    notes: "",
    lines: [newLine()],
  });

  const load = useCallback(async (query: string, status: "" | SalesQuoteStatus) => {
    setState({ kind: "loading" });
    const res = await fetchSalesQuotes({ q: query, status });
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
    void load(q, statusFilter);
    void fetchWarehouses().then((res) => {
      if (res.ok) setWarehouses(res.items);
    });
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setForm({
      customerId: null,
      customerLabel: "",
      warehouseId: warehouses[0]?.id ?? null,
      warehouseLabel: warehouses[0]
        ? `${warehouses[0].code} — ${warehouses[0].name}`
        : "",
      validUntil: "",
      notes: "",
      lines: [newLine()],
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function searchCustomer(text: string) {
    setCustomerLoading(true);
    void searchCustomers(text).then((res) => {
      setCustomerLoading(false);
      if (!res.ok) {
        setCustomerOpts([]);
        return;
      }
      setCustomerOpts(
        res.items.map((c) => ({
          id: c.id,
          label: `${c.code} — ${c.legalName}`,
        })),
      );
    });
  }

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
        })),
      }));
    });
  }

  async function onCreate() {
    if (!form.customerId) {
      setFormError("Sélectionnez un client.");
      return;
    }
    const lines = [];
    for (const line of form.lines) {
      if (!line.productId) {
        setFormError("Chaque ligne doit avoir un produit.");
        return;
      }
      const qty = Number(line.qty.replace(",", "."));
      const unitPrice = Number(line.unitPrice.replace(",", "."));
      const discountPct = Number(line.discountPct.replace(",", ".") || "0");
      if (!Number.isFinite(qty) || qty <= 0) {
        setFormError("Quantité invalide.");
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        setFormError("Prix invalide.");
        return;
      }
      if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) {
        setFormError("Remise % invalide (0–100).");
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
      setFormError("Ajoutez au moins une ligne.");
      return;
    }

    setBusy(true);
    setFormError(null);
    const res = await createSalesQuote({
      customerId: form.customerId,
      warehouseId: form.warehouseId ?? undefined,
      validUntil: form.validUntil || undefined,
      notes: form.notes.trim() || undefined,
      lines,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q, statusFilter);
    router.push(`/sales/quotes/${res.data.id}`);
  }

  const recordCount = state.kind === "ok" ? state.items.length : null;

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/" className="hover:text-a-fg">
            Ventes
          </Link>
        }
        title="Devis"
        description={erpListDescription(
          recordCount,
          "Brouillon → Envoyé → Convertir → commande DRAFT (sans confirm auto)",
        )}
        primary={
          <AButton type="button" size="sm" onClick={openCreate}>
            Nouveau devis
          </AButton>
        }
      />
      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="sq-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher devis, clients…"
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
                const next = (id === "all" ? "" : id) as "" | SalesQuoteStatus;
                setStatusFilter(next);
                void load(q, next);
              }}
              items={STATUS_FILTERS.map((chip) => ({
                id: chip.id || "all",
                label: chip.label,
              }))}
            />
          }
          utilities={
            <AListUtilities onFilter={() => void load(q, statusFilter)} />
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
            title="Aucun devis"
            description="Créez un devis multi-lignes avec remises, envoyez-le, puis convertissez en commande brouillon."
            actionLabel="Nouveau devis"
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <ASoftTable className="min-w-[48rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>Devis</ASoftTh>
                <ASoftTh>Client</ASoftTh>
                <ASoftTh>Validité</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
                <ASoftTh numeric>Montant</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((row) => (
                <ASoftTr key={row.id}>
                  <ASoftTd>
                    <Link
                      href={`/sales/quotes/${row.id}`}
                      className="a-mono font-medium text-a-accent hover:underline"
                    >
                      {row.number}
                    </Link>
                  </ASoftTd>
                  <ASoftTd>
                    <span className="a-mono text-a-fg-muted">{row.customerCode}</span>{" "}
                    {row.customerName}
                  </ASoftTd>
                  <ASoftTd className="a-mono">{row.validUntil ?? "—"}</ASoftTd>
                  <ASoftTd>
                    <ABadge tone={quoteBadgeTone(row.status)}>
                      {QUOTE_STATUS_LABELS[row.status]}
                    </ABadge>
                  </ASoftTd>
                  <ASoftTd numeric className="a-mono">
                    {row.amountTotal} {row.currency}
                  </ASoftTd>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        ) : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Nouveau devis"
        description="Pas de réserve stock — conversion → commande DRAFT"
        footer={
          <div className="flex justify-end gap-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setDrawerOpen(false)}
            >
              {LAYOUT_ACTIONS.cancel}
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onCreate()}
            >
              Créer
            </AButton>
          </div>
        }
      >
        <div className="space-y-4">
          <AFormSection title="Client & entrepôt">
            <ACombobox
              label="Client"
              valueId={form.customerId}
              displayValue={form.customerLabel}
              onDisplayChange={(text) => {
                setForm({ ...form, customerLabel: text, customerId: null });
                searchCustomer(text);
              }}
              onSelect={(opt) =>
                setForm({
                  ...form,
                  customerId: opt.id,
                  customerLabel: opt.label,
                })
              }
              onOpen={() => searchCustomer(form.customerLabel)}
              options={customerOpts}
              loading={customerLoading}
              placeholder="Code ou nom…"
              emptyText="Aucun client"
            />
            <div className="space-y-1">
              <label className="a-field-label">Entrepôt (requis pour convertir)</label>
              <select
                className="mt-1 w-full rounded-[var(--a-radius-sm)] border border-a-border bg-a-surface-2 px-2 py-1.5 text-[length:var(--a-text-sm)]"
                value={form.warehouseId ?? ""}
                onChange={(e) => {
                  const wh = warehouses.find((w) => w.id === e.target.value);
                  setForm({
                    ...form,
                    warehouseId: wh?.id ?? null,
                    warehouseLabel: wh ? `${wh.code} — ${wh.name}` : "",
                  });
                }}
              >
                <option value="">—</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="a-field-label">Valable jusqu’au</label>
              <AInput
                type="date"
                value={form.validUntil}
                onChange={(e) =>
                  setForm({ ...form, validUntil: e.target.value })
                }
              />
            </div>
          </AFormSection>

          <AFormSection title="Articles" description="Remise % 0–100 par ligne">
            <div className="flex justify-end">
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
                    if (form.customerId) {
                      void suggestCustomerPrice(form.customerId, opt.id).then(
                        (res) => {
                          if (!res.ok || !res.data.unitPrice) return;
                          const price = res.data.unitPrice;
                          setForm((prev) => ({
                            ...prev,
                            lines: prev.lines.map((l) =>
                              l.key === line.key
                                ? { ...l, unitPrice: price }
                                : l,
                            ),
                          }));
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
                  emptyText="Aucun produit"
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
                  Net :{" "}
                  {lineNetTotal(
                    line.qty,
                    line.unitPrice,
                    line.discountPct,
                  ).toFixed(3)}
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
      </ADrawer>
    </>
  );
}

export default function SalesQuotesPage() {
  return (
    <Suspense
      fallback={
        <APageBody>
          <ASkeleton className="h-10 w-48" />
          <ASkeleton className="h-10 w-full" />
        </APageBody>
      }
    >
      <QuotesPageInner />
    </Suspense>
  );
}
