"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ACombobox,
  ADrawer,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AInput,
  APageBody,
  AScreenHeader,
  ASkeleton,
  ATabs,
  type AComboboxOption,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import {
  fetchWarehouses,
  type InventoryWarehouse,
} from "@/lib/inventory";
import { searchCustomers, searchProducts } from "@/lib/sales";
import { suggestCustomerPrice } from "@/lib/customers";
import { softChipClass, softSelect } from "@/lib/soft-glass-ui";
import {
  WA_INBOX_STATUS_LABELS,
  createWaInboxDraft,
  dismissWaInbox,
  fetchWaInbox,
  fetchWaSuggestLines,
  matchWaInbox,
  type WaInboxItem,
  type WaInboxStatus,
  type WaSuggestLine,
} from "@/lib/wa-inbox";

const STATUS_FILTERS: { id: "" | WaInboxStatus; label: string }[] = [
  { id: "", label: "Tout" },
  { id: "OPEN", label: "Ouvert" },
  { id: "MATCHED", label: "Client lié" },
  { id: "DRAFT_CREATED", label: "Brouillon" },
  { id: "DISMISSED", label: "Ignoré" },
];

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: WaInboxItem[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function statusTone(
  s: WaInboxStatus,
): "success" | "warning" | "info" | "neutral" {
  if (s === "DRAFT_CREATED") return "success";
  if (s === "MATCHED") return "info";
  if (s === "OPEN") return "warning";
  return "neutral";
}

export default function SalesWaInboxPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [statusFilter, setStatusFilter] = useState<"" | WaInboxStatus>("OPEN");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [draftOpen, setDraftOpen] = useState(false);
  const [active, setActive] = useState<WaInboxItem | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerLabel, setCustomerLabel] = useState("");
  const [customerOpts, setCustomerOpts] = useState<AComboboxOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [productLabel, setProductLabel] = useState("");
  const [productOpts, setProductOpts] = useState<AComboboxOption[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [lines, setLines] = useState<
    Array<{ productId: string; label: string; qty: number; unitPrice: number }>
  >([]);
  const [suggestions, setSuggestions] = useState<WaSuggestLine[]>([]);
  const [suggestedQty, setSuggestedQty] = useState<number | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const load = useCallback(async (status: "" | WaInboxStatus) => {
    setState({ kind: "loading" });
    const res = await fetchWaInbox({ status: status || undefined });
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
    void load(statusFilter);
  }, [load, statusFilter]);

  useEffect(() => {
    void (async () => {
      const res = await fetchWarehouses();
      if (res.ok) {
        setWarehouses(res.items);
        if (res.items[0]) setWarehouseId(res.items[0].id);
      }
    })();
  }, []);

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

  const refreshProducts = useCallback((qText: string) => {
    setProductLoading(true);
    void searchProducts(qText).then((res) => {
      setProductLoading(false);
      if (!res.ok) {
        setProductOpts([]);
        return;
      }
      setProductOpts(
        res.items.map((p) => ({
          id: p.id,
          label: `${p.sku} — ${p.name}`,
        })),
      );
    });
  }, []);

  useEffect(() => {
    if (!draftOpen) return;
    const t = window.setTimeout(
      () => refreshCustomers(customerLabel.trim()),
      150,
    );
    return () => window.clearTimeout(t);
  }, [draftOpen, customerLabel, refreshCustomers]);

  useEffect(() => {
    if (!draftOpen) return;
    const t = window.setTimeout(
      () => refreshProducts(productLabel.trim()),
      150,
    );
    return () => window.clearTimeout(t);
  }, [draftOpen, productLabel, refreshProducts]);

  function openDraft(row: WaInboxItem) {
    setActionError(null);
    setActive(row);
    setLines([]);
    setSuggestions([]);
    setSuggestedQty(null);
    setQty("1");
    setUnitPrice("0");
    setProductId(null);
    setProductLabel("");
    if (row.customerId && row.customerName) {
      setCustomerId(row.customerId);
      setCustomerLabel(
        `${row.customerCode ?? ""} — ${row.customerName}`.trim(),
      );
    } else {
      setCustomerId(null);
      setCustomerLabel("");
    }
    setDraftOpen(true);
    setSuggestLoading(true);
    void fetchWaSuggestLines(row.id).then((res) => {
      setSuggestLoading(false);
      if (!res.ok) return;
      setSuggestions(res.data.items);
      if (res.data.suggestedQty != null) {
        setSuggestedQty(res.data.suggestedQty);
        setQty(String(res.data.suggestedQty));
      }
    });
  }

  async function addSuggestion(s: WaSuggestLine) {
    const qn = suggestedQty && suggestedQty > 0 ? suggestedQty : 1;
    let price = 0;
    const cust = customerId ?? active?.customerId ?? null;
    if (cust) {
      const priceRes = await suggestCustomerPrice(cust, s.productId);
      if (priceRes.ok && priceRes.data.unitPrice != null) {
        price = Number(priceRes.data.unitPrice);
      }
    }
    setLines((prev) => {
      if (prev.some((l) => l.productId === s.productId)) return prev;
      return [
        ...prev,
        {
          productId: s.productId,
          label: `${s.sku} — ${s.name}`,
          qty: qn,
          unitPrice: Number.isFinite(price) ? price : 0,
        },
      ];
    });
  }

  async function ensureMatched(row: WaInboxItem): Promise<WaInboxItem | null> {
    if (row.customerId) return row;
    if (!customerId) {
      setActionError("Choisissez un client avant de créer le brouillon.");
      return null;
    }
    const res = await matchWaInbox(row.id, {
      version: row.version,
      customerId,
    });
    if (!res.ok) {
      setActionError(res.message);
      return null;
    }
    return res.data;
  }

  async function onCreateDraft() {
    if (!active) return;
    setBusy(true);
    setActionError(null);
    try {
      const matched = await ensureMatched(active);
      if (!matched) return;
      if (!warehouseId) {
        setActionError("Entrepôt requis.");
        return;
      }
      if (lines.length === 0) {
        setActionError(
          "Ajoutez au moins une ligne produit (humain — pas de NLP).",
        );
        return;
      }
      const res = await createWaInboxDraft(matched.id, {
        version: matched.version,
        warehouseId,
        lines: lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
      });
      if (!res.ok) {
        setActionError(res.message);
        return;
      }
      setDraftOpen(false);
      router.push(`/sales/${res.data.order.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDismiss(row: WaInboxItem) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await dismissWaInbox(row.id, { version: row.version });
      if (!res.ok) {
        setActionError(res.message);
        return;
      }
      await load(statusFilter);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AScreenHeader
        kicker="Ventes"
        title="Inbox WhatsApp"
        description="Messages entrants Meta → brouillon . Suggestions produit assistées (chips) — pas d’auto-confirm (D251/D252)."
        primary={
          <AButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load(statusFilter)}
          >
            Actualiser
          </AButton>
        }
        more={
          <Link
            href="/sales"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted underline-offset-2 hover:underline"
          >
            Commandes →
          </Link>
        }
      />
      <APageBody>
        <AFilterBar
          search={
            <ATabs
              ariaLabel="Filtrer par statut"
              value={statusFilter || "all"}
              onValueChange={(id) => {
                const next = (id === "all" ? "" : id) as "" | WaInboxStatus;
                setStatusFilter(next);
              }}
              items={STATUS_FILTERS.map((f) => ({
                id: f.id || "all",
                label: f.label,
              }))}
            />
          }
        />

        {actionError && !draftOpen ? (
          <p className="mb-3 text-[length:var(--a-text-sm)] text-a-danger">
            {actionError}
          </p>
        ) : null}

        {state.kind === "loading" && <ASkeleton className="h-40 w-full" />}
        {state.kind === "forbidden" && (
          <AForbiddenState message={state.message} />
        )}
        {state.kind === "error" && <AErrorState message={state.message} />}
        {state.kind === "ok" && state.items.length === 0 && (
          <AEmptyState
            title="Aucun message"
            description="Configurez le webhook Meta (Prefs Relances). Les messages OPEN/MATCHED apparaissent aussi dans la cloche (source WA)."
          />
        )}
        {state.kind === "ok" && state.items.length > 0 && (
          <ul className="space-y-2">
            {state.items.map((row) => (
              <li
                key={row.id}
                className="a-underlay flex flex-col gap-2 px-4 py-3 md:flex-row md:items-start md:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ABadge tone={statusTone(row.status)}>
                      {WA_INBOX_STATUS_LABELS[row.status]}
                    </ABadge>
                    <span className="font-mono text-[length:var(--a-text-xs)] text-a-fg-muted tabular-nums">
                      {row.fromPhone}
                    </span>
                    {row.profileName ? (
                      <span className="text-[length:var(--a-text-sm)]">
                        {row.profileName}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[length:var(--a-text-sm)] text-a-fg">
                    {row.bodyText ?? `(${row.messageType})`}
                  </p>
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    {new Date(row.receivedAt).toLocaleString("fr-TN")}
                    {row.customerName
                      ? ` · ${row.customerCode} ${row.customerName}`
                      : " · client non lié"}
                    {row.orderNumber ? ` · cmd ${row.orderNumber}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {row.orderId ? (
                    <AButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => router.push(`/sales/${row.orderId}`)}
                    >
                      Voir brouillon
                    </AButton>
                  ) : row.status !== "DISMISSED" ? (
                    <>
                      <AButton
                        type="button"
                        size="sm"
                        onClick={() => openDraft(row)}
                      >
                        Créer brouillon
                      </AButton>
                      <AButton
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void onDismiss(row)}
                      >
                        Ignorer
                      </AButton>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </APageBody>

      <ADrawer
        open={draftOpen}
        onOpenChange={setDraftOpen}
        title="Brouillon depuis WhatsApp"
        description="Lignes saisies par ADV — confirm commande séparé (sales.confirm)."
      >
        {active && (
          <div className="space-y-3">
            {actionError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {actionError}
              </p>
            ) : null}
            <p className="a-underlay px-3 py-2 text-[length:var(--a-text-sm)]">
              {active.bodyText ?? `(${active.messageType})`}
            </p>
            {(suggestLoading || suggestions.length > 0) && (
              <div className="space-y-2">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Suggestions (assistées — cliquez pour ajouter)
                </span>
                {suggestLoading ? (
                  <ASkeleton className="h-8 w-full" />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s.productId}
                        type="button"
                        className={softChipClass(false)}
                        title={`token « ${s.matchedToken} » · score ${s.score}`}
                        onClick={() => void addSuggestion(s)}
                      >
                        {s.sku} · {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <ACombobox
              label="Client *"
              valueId={customerId}
              displayValue={customerLabel}
              onDisplayChange={(text) => {
                setCustomerLabel(text);
                if (!active.customerId) setCustomerId(null);
              }}
              onSelect={(opt) => {
                setCustomerId(opt.id);
                setCustomerLabel(opt.label);
              }}
              onOpen={() => refreshCustomers(customerLabel.trim())}
              options={customerOpts}
              loading={customerLoading}
              disabled={!!active.customerId}
              placeholder="Code ou raison sociale…"
            />
            <label className="block space-y-1">
              <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Entrepôt *
              </span>
              <select
                className={softSelect}
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </option>
                ))}
              </select>
            </label>
            <ACombobox
              label="Produit"
              valueId={productId}
              displayValue={productLabel}
              onDisplayChange={(text) => {
                setProductLabel(text);
                setProductId(null);
              }}
              onSelect={(opt) => {
                setProductId(opt.id);
                setProductLabel(opt.label);
              }}
              onOpen={() => refreshProducts(productLabel.trim())}
              options={productOpts}
              loading={productLoading}
              placeholder="SKU ou nom…"
            />
            <div className="grid grid-cols-2 gap-2">
              <AInput
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Qté"
                inputMode="decimal"
              />
              <AInput
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="PU HT"
                inputMode="decimal"
              />
            </div>
            <AButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                if (!productId) return;
                const qn = Number(qty.replace(",", "."));
                const pn = Number(unitPrice.replace(",", "."));
                if (!Number.isFinite(qn) || qn <= 0) return;
                if (!Number.isFinite(pn) || pn < 0) return;
                setLines((prev) => [
                  ...prev,
                  {
                    productId,
                    label: productLabel,
                    qty: qn,
                    unitPrice: pn,
                  },
                ]);
                setProductId(null);
                setProductLabel("");
                setQty("1");
              }}
            >
              + Ligne
            </AButton>
            {lines.length > 0 ? (
              <ul className="space-y-1 text-[length:var(--a-text-sm)]">
                {lines.map((l, i) => (
                  <li
                    key={`${l.productId}-${i}`}
                    className="flex justify-between gap-2"
                  >
                    <span>
                      {l.label} · {l.qty} × {l.unitPrice}
                    </span>
                    <button
                      type="button"
                      className="text-a-fg-muted underline-offset-2 hover:underline"
                      onClick={() =>
                        setLines((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDraftOpen(false)}
              >
                Annuler
              </AButton>
              <AButton
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void onCreateDraft()}
              >
                {LAYOUT_ACTIONS.save}
              </AButton>
            </div>
          </div>
        )}
      </ADrawer>
    </>
  );
}
