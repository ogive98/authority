"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AButton,
  ACombobox,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
  type AComboboxOption,
} from "@/components/a";
import {
  fetchWarehouses,
  type InventoryWarehouse,
} from "@/lib/inventory";
import {
  STATUS_LABELS,
  cancelSalesOrder,
  confirmSalesOrder,
  createSalesOrder,
  fetchIntakeSettings,
  fetchSalesOrders,
  searchCustomers,
  searchProducts,
  type SalesIntakeSettings,
  type SalesOrder,
} from "@/lib/sales";

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
};

type FormState = {
  customerId: string | null;
  customerLabel: string;
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
  };
}

export default function SalesPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
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

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const res = await fetchSalesOrders(query);
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
  }, [load]);

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

  function openCreate() {
    setFormError(null);
    const wh = warehouses[0];
    setForm({
      customerId: null,
      customerLabel: "",
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
  }

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
      if (!Number.isFinite(qty) || qty <= 0) {
        setFormError("Quantité invalide sur une ligne.");
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        setFormError("Prix invalide sur une ligne.");
        return;
      }
      lines.push({ productId: line.productId, qty, unitPrice });
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
    await load(q);
  }

  async function onConfirm(row: SalesOrder) {
    const res = await confirmSalesOrder(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  async function onCancel(row: SalesOrder) {
    const res = await cancelSalesOrder(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  const workflowHint = settings
    ? [
        "Crédit (stub)",
        "Prix",
        settings.reserveOnConfirm ? "Stock → réserve" : "Stock (réserve off)",
        "Confirmé + events",
      ].join(" → ")
    : "Crédit → prix → stock → réserve → confirm";

  return (
    <>
      <AScreenHeader
        kicker="Ventes"
        title="Commandes"
        description={`Prise de commande multi-lignes. Workflow: ${workflowHint}.`}
        actions={
          <AButton type="button" size="sm" onClick={openCreate}>
            Nouvelle commande
          </AButton>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label
              htmlFor="so-q"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Recherche
            </label>
            <AInput
              id="so-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° commande"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q);
              }}
            />
          </div>
          <AButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load(q)}
          >
            Filtrer
          </AButton>
        </div>

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
            title="Aucune commande"
            description="Saisissez le surnom ou le code client, ajoutez plusieurs articles, puis confirmez."
            actionLabel="Nouvelle commande"
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--a-radius-md)] border border-a-border-subtle">
            <table className="w-full min-w-[48rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="border-b border-a-border-subtle bg-a-surface-2 text-a-fg-muted">
                <tr>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    N°
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Client
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Lignes
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Montant
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Statut
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-a-border-subtle last:border-0 hover:bg-a-surface-3/60"
                  >
                    <td className="a-mono px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.number}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.customerName ?? row.customerCode ?? "—"}
                    </td>
                    <td className="a-mono px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] text-a-fg-muted">
                      {row.lines.length}
                    </td>
                    <td className="a-mono px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.amountTotal} {row.currency}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      <span
                        className={
                          row.status === "CONFIRMED"
                            ? "text-a-success"
                            : row.status === "CANCELLED"
                              ? "text-a-warning"
                              : "text-a-fg-muted"
                        }
                      >
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      <div className="flex flex-wrap gap-2">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

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
          <div className="space-y-4">
            <p className="rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-1 px-3 py-2 text-[length:var(--a-text-xs)] text-a-fg-muted">
              Workflow auto à la confirmation : {workflowHint}
              {settings?.autoConfirmOnCreate
                ? " · auto_confirm_on_create=ON"
                : ""}
            </p>

            <ACombobox
              label="Client (surnom, code ou raison sociale)"
              valueId={form.customerId}
              displayValue={form.customerLabel}
              onDisplayChange={(text) =>
                setForm({
                  ...form,
                  customerLabel: text,
                  customerId: null,
                })
              }
              onSelect={(opt) =>
                setForm({
                  ...form,
                  customerId: opt.id,
                  customerLabel: opt.label,
                })
              }
              onOpen={() => refreshCustomers(form.customerLabel.trim())}
              options={customerOpts}
              loading={customerLoading}
              placeholder="Ex. Atlas, C-001…"
              emptyText="Aucun client — créez-en un ou affinez la saisie"
            />

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
              <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Date demandée
                {settings?.requireRequestedDate ? " *" : ""}
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
              <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Livreur souhaité
              </label>
              <AInput
                value={form.preferredDriver}
                onChange={(e) =>
                  setForm({ ...form, preferredDriver: e.target.value })
                }
                placeholder="Nom libre — assignation tournée = module Delivery"
              />
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Hint pour la préparation. L’affectation véhicule/chauffeur réelle
                est portée par Delivery (phase suivante).
              </p>
            </div>

            <div className="space-y-3 border-t border-a-border-subtle pt-4">
              <div className="flex items-center justify-between">
                <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                  Articles
                </p>
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
                  className="space-y-2 rounded-[var(--a-radius-md)] border border-a-border-subtle p-3"
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
                    onSelect={(opt) =>
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
                      })
                    }
                    onOpen={() =>
                      searchProductForLine(line.key, line.productLabel)
                    }
                    options={productOptsByKey[line.key] ?? []}
                    loading={productLoadingKey === line.key}
                    placeholder="SKU ou nom…"
                    emptyText="Aucun produit — activez un article dans Catalogue"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                        Qté
                      </label>
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
                      <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                        Prix u.
                      </label>
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
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Notes
              </label>
              <AInput
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

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
