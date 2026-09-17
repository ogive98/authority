"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  ABadge,
  AButton,
  ACombobox,
  ADrawer,
  AEmptyState,
  AErrorState,
  AField,
  AFilterBar,
  AForbiddenState,
  AFormSection,
  AInput,
  AListUtilities,
  AOverflowMenu,
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
import { FulfillmentDocToggle } from "@/components/fulfillment-doc-toggle";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import {
  fetchCustomers,
  FULFILLMENT_DOC_LABELS,
  type FulfillmentDoc,
} from "@/lib/customers";
import {
  INVOICE_STATUS_LABELS,
  cancelInvoice,
  createInvoice,
  fetchInvoices,
  invoiceBadgeTone,
  issueInvoice,
  type FinInvoice,
  type InvoiceStatus,
} from "@/lib/finance";
import { fetchTaxCodes, formatRateBps, type TaxCode } from "@/lib/tax";
import {
  fetchProductFiscal,
  fetchProducts,
  type Product,
} from "@/lib/products";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import { softSelect } from "@/lib/d294-ui";
import { ATabs } from "@/components/a/a-tabs";

const STATUS_FILTERS: { id: "" | InvoiceStatus; label: string }[] = [
  { id: "", label: "Tout" },
  { id: "DRAFT", label: "Brouillon" },
  { id: "ISSUED", label: "Émise" },
  { id: "CANCELLED", label: "Annulée" },
];

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FinInvoice[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type LineDraft = {
  description: string;
  qty: string;
  unitPriceHt: string;
  taxCodeId: string;
  productId: string;
  vatSource: "manual" | "product" | "stub";
};

type FormState = {
  customerId: string | null;
  customerLabel: string;
  fulfillmentDoc: FulfillmentDoc;
  dueDate: string;
  label: string;
  issue: boolean;
  lines: LineDraft[];
};

function emptyLine(taxCodeId = ""): LineDraft {
  return {
    description: "",
    qty: "1",
    unitPriceHt: "",
    taxCodeId,
    productId: "",
    vatSource: taxCodeId ? "stub" : "manual",
  };
}

export default function FinanceInvoicesPage() {
  return (
    <Suspense
      fallback={
        <APageBody>
          <ASkeleton className="h-10 w-48" />
          <ASkeleton className="h-10 w-full" />
        </APageBody>
      }
    >
      <FinanceInvoicesPageInner />
    </Suspense>
  );
}

function FinanceInvoicesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | InvoiceStatus>(() => {
    const s = searchParams.get("status");
    if (s === "DRAFT" || s === "ISSUED" || s === "CANCELLED") return s;
    return "";
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [customerOpts, setCustomerOpts] = useState<AComboboxOption[]>([]);
  const [customerPrefs, setCustomerPrefs] = useState<
    Record<string, FulfillmentDoc>
  >({});
  const [customerLoading, setCustomerLoading] = useState(false);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (query?: string, status?: "" | InvoiceStatus) => {
      setState({ kind: "loading" });
      const res = await fetchInvoices({
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
    },
    [],
  );

  useEffect(() => {
    void load("", statusFilter);
    // initial hydrate only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  function syncStatusUrl(next: "" | InvoiceStatus) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set("status", next);
    else sp.delete("status");
    const qs = sp.toString();
    router.replace(qs ? `/finance/invoices?${qs}` : "/finance/invoices", {
      scroll: false,
    });
  }

  useEffect(() => {
    const s = searchParams.get("status");
    const next: "" | InvoiceStatus =
      s === "DRAFT" || s === "ISSUED" || s === "CANCELLED" ? s : "";
    if (next !== statusFilter) {
      setStatusFilter(next);
      void load(q, next);
    }
    // sync from URL only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      const [taxRes, prodRes] = await Promise.all([
        fetchTaxCodes(),
        fetchProducts(),
      ]);
      if (taxRes.ok) setTaxCodes(taxRes.data.items);
      if (prodRes.ok) setProducts(prodRes.data.items);
    })();
  }, []);

  const refreshCustomers = useCallback(async (query: string) => {
    setCustomerLoading(true);
    const res = await fetchCustomers(query);
    setCustomerLoading(false);
    if (!res.ok) {
      setCustomerOpts([]);
      return;
    }
    setCustomerOpts(
      res.data.items.map((c) => ({
        id: c.id,
        label: `${c.code} — ${c.legalName}`,
      })),
    );
    setCustomerPrefs((prev) => {
      const next = { ...prev };
      for (const c of res.data.items) {
        next[c.id] = c.fulfillmentDoc ?? "DELIVERY_NOTE";
      }
      return next;
    });
  }, []);

  function scheduleCustomerSearch(text: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void refreshCustomers(text);
    }, 200);
  }

  function openCreate() {
    const defaultTax =
      taxCodes.find((c) => c.code === "TVA19")?.id ?? taxCodes[0]?.id ?? "";
    setFormError(null);
    setForm({
      customerId: null,
      customerLabel: "",
      fulfillmentDoc: "DELIVERY_NOTE",
      dueDate: "",
      label: "",
      issue: true,
      lines: [emptyLine(defaultTax)],
    });
    setDrawerOpen(true);
  }

  async function applyProductToLine(idx: number, productId: string) {
    if (!form) return;
    if (!productId) {
      const stub =
        taxCodes.find((c) => c.code === "TVA19")?.id ?? taxCodes[0]?.id ?? "";
      setForm({
        ...form,
        lines: form.lines.map((l, i) =>
          i === idx
            ? {
                ...l,
                productId: "",
                taxCodeId: stub,
                vatSource: stub ? "stub" : "manual",
              }
            : l,
        ),
      });
      return;
    }
    const product = products.find((p) => p.id === productId);
    const fiscal = await fetchProductFiscal(productId);
    const stub =
      taxCodes.find((c) => c.code === "TVA19")?.id ?? taxCodes[0]?.id ?? "";
    let taxCodeId = stub;
    let vatSource: LineDraft["vatSource"] = "stub";
    if (fiscal.ok && fiscal.data.profile.defaultVatTaxCodeId) {
      taxCodeId = fiscal.data.profile.defaultVatTaxCodeId;
      const notes = fiscal.data.profile.notes ?? "";
      vatSource = notes.includes("STUB_UNTIL_EXPERT") ? "stub" : "product";
    }
    setForm({
      ...form,
      lines: form.lines.map((l, i) =>
        i === idx
          ? {
              ...l,
              productId,
              description: l.description.trim()
                ? l.description
                : (product?.name ?? l.description),
              taxCodeId,
              vatSource,
            }
          : l,
      ),
    });
  }

  async function submit() {
    if (!form?.customerId) {
      setFormError("Sélectionnez un client.");
      return;
    }
    const lines = form.lines.map((l) => ({
      description: l.description.trim(),
      qty: Number(l.qty.replace(",", ".")),
      unitPriceHt: Number(l.unitPriceHt.replace(",", ".")),
      taxCodeId: l.taxCodeId || undefined,
      productId: l.productId || undefined,
    }));
    if (
      lines.length === 0 ||
      lines.some(
        (l) =>
          !l.description ||
          (!l.taxCodeId && !l.productId) ||
          !Number.isFinite(l.qty) ||
          l.qty <= 0 ||
          !Number.isFinite(l.unitPriceHt) ||
          l.unitPriceHt < 0,
      )
    ) {
      setFormError(
        "Chaque ligne : description, qté, PU HT, et produit ou code TVA.",
      );
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createInvoice({
      customerId: form.customerId,
      lines,
      dueDate: form.dueDate || undefined,
      label: form.label.trim() || undefined,
      currency: "TND",
      issue: form.issue,
      fulfillmentDoc: form.fulfillmentDoc,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    router.push(`/finance/invoices/${res.data.id}`);
  }

  async function onIssue(invoiceId: string) {
    setBusy(true);
    const res = await issueInvoice(invoiceId);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q, statusFilter);
  }

  async function onCancel(invoiceId: string) {
    if (
      !window.confirm(
        "Annuler cette facture ? La créance ouverte sera clôturée et le GL décomptabilisé via Thunder.",
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await cancelInvoice(invoiceId);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q, statusFilter);
  }

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Factures"
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "HT / TVA / TTC · TVA produit · FODEC·timbre si Prefs VALIDATED",
        )}
        primary={
          <AButton type="button" size="sm" onClick={openCreate}>
            {LAYOUT_ACTIONS.newInvoice}
          </AButton>
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "tax",
                label: "TVA Tunisie",
                onSelect: () => router.push("/tax"),
              },
              {
                id: "receivables",
                label: "Créances",
                onSelect: () => router.push("/finance"),
              },
              {
                id: "credit-notes",
                label: "Avoirs",
                onSelect: () => router.push("/finance/credit-notes"),
              },
              {
                id: "banking",
                label: "Banque",
                onSelect: () => router.push("/finance/banking"),
              },
            ]}
          />
        }
      />
      <APageBody>
        <ExpertiseHintsStrip keys={["tax.fodec", "tax.timbre", "tax.ras", "tax.tej"]} />

        <AFilterBar
          search={
            <AInput
              id="inv-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° / libellé"
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
                const next = (id === "all" ? "" : id) as "" | InvoiceStatus;
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
            title="Aucune facture"
            description="Créez une facture avec lignes et codes TVA."
            actionLabel={LAYOUT_ACTIONS.newInvoice}
            onAction={openCreate}
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <ASoftTable className="min-w-[56rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>N°</ASoftTh>
                <ASoftTh>Document</ASoftTh>
                <ASoftTh>Client</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
                <ASoftTh numeric>HT</ASoftTh>
                <ASoftTh numeric>TVA</ASoftTh>
                <ASoftTh numeric>TTC</ASoftTh>
                <ASoftTh>Actions</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((inv) => (
                <ASoftTr
                  key={inv.id}
                  onClick={() => router.push(`/finance/invoices/${inv.id}`)}
                >
                  <ASoftTd>
                    <Link
                      href={`/finance/invoices/${inv.id}`}
                      className="a-mono font-semibold text-a-accent hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {inv.number}
                    </Link>
                  </ASoftTd>
                  <ASoftTd>
                    {
                      FULFILLMENT_DOC_LABELS[
                        inv.fulfillmentDoc ?? "DELIVERY_NOTE"
                      ]
                    }
                  </ASoftTd>
                  <ASoftTd>
                    {inv.customerName ?? inv.customerCode ?? "—"}
                  </ASoftTd>
                  <ASoftTd>
                    <ABadge tone={invoiceBadgeTone(inv.status)}>
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </ABadge>
                  </ASoftTd>
                  <ASoftTd numeric>{inv.amountHt ?? "—"}</ASoftTd>
                  <ASoftTd numeric>{inv.amountTax ?? "—"}</ASoftTd>
                  <ASoftTd numeric>
                    {inv.amountTotal} {inv.currency}
                  </ASoftTd>
                  <ASoftTd>
                    <div
                      className="flex flex-wrap gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link href={`/finance/invoices/${inv.id}`}>
                        <AButton type="button" variant="secondary" size="sm">
                          Fiche
                        </AButton>
                      </Link>
                      {inv.status === "DRAFT" ? (
                        <AButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => void onIssue(inv.id)}
                        >
                          Émettre
                        </AButton>
                      ) : null}
                      {inv.status === "ISSUED" ? (
                        <Link
                          href={`/finance/credit-notes?invoiceId=${encodeURIComponent(inv.id)}`}
                          className="inline-flex"
                        >
                          <AButton
                            type="button"
                            variant="secondary"
                            size="sm"
                          >
                            Avoir
                          </AButton>
                        </Link>
                      ) : null}
                      {inv.status === "DRAFT" || inv.status === "ISSUED" ? (
                        <AButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void onCancel(inv.id)}
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
        title="Nouvelle facture"
        description="Lignes HT + code TVA catalogue · FODEC/timbre si Prefs VALIDATED"
        className="max-w-xl"
      >
        {form ? (
          <div className="space-y-5">
            <AFormSection title="Client & document">
              <ACombobox
                label="Client"
                valueId={form.customerId}
                displayValue={form.customerLabel}
                onDisplayChange={(text) => {
                  setForm({ ...form, customerLabel: text, customerId: null });
                  scheduleCustomerSearch(text);
                }}
                onSelect={(opt) => {
                  const pref = customerPrefs[opt.id] ?? "DELIVERY_NOTE";
                  setForm({
                    ...form,
                    customerId: opt.id,
                    customerLabel: opt.label,
                    fulfillmentDoc: pref,
                  });
                }}
                onOpen={() => void refreshCustomers(form.customerLabel)}
                options={customerOpts}
                loading={customerLoading}
                placeholder="Code ou raison sociale…"
                emptyText="Aucun client"
              />

              <FulfillmentDocToggle
                value={form.fulfillmentDoc}
                onChange={(fulfillmentDoc) =>
                  setForm({ ...form, fulfillmentDoc })
                }
                hint="Préférence fiche client — change seulement le titre. Même lignes, même compta, mêmes modes."
              />
            </AFormSection>

            <AFormSection title="Échéance / libellé">
              <AField label="Échéance">
                <AInput
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm({ ...form, dueDate: e.target.value })
                  }
                />
              </AField>

              <AField label="Libellé">
                <AInput
                  value={form.label}
                  onChange={(e) =>
                    setForm({ ...form, label: e.target.value })
                  }
                />
              </AField>
            </AFormSection>

            <AFormSection title="Lignes">
              <div className="flex items-center justify-end">
                <AButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setForm({
                      ...form,
                      lines: [
                        ...form.lines,
                        emptyLine(
                          taxCodes.find((c) => c.code === "TVA19")?.id ??
                            taxCodes[0]?.id ??
                            "",
                        ),
                      ],
                    })
                  }
                >
                  + Ligne
                </AButton>
              </div>
              {form.lines.map((line, idx) => (
                <div
                  key={idx}
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
                            lines: form.lines.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        Retirer
                      </AButton>
                    ) : null}
                  </div>
                  <AInput
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        lines: form.lines.map((l, i) =>
                          i === idx
                            ? { ...l, description: e.target.value }
                            : l,
                        ),
                      })
                    }
                  />
                  <select
                    className={softSelect}
                    value={line.productId}
                    onChange={(e) =>
                      void applyProductToLine(idx, e.target.value)
                    }
                    aria-label={`Produit ligne ${idx + 1}`}
                  >
                    <option value="">Produit (optionnel)…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-3 gap-2">
                    <AInput
                      placeholder="Qté"
                      value={line.qty}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, i) =>
                            i === idx ? { ...l, qty: e.target.value } : l,
                          ),
                        })
                      }
                    />
                    <AInput
                      placeholder="PU HT"
                      value={line.unitPriceHt}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, i) =>
                            i === idx
                              ? { ...l, unitPriceHt: e.target.value }
                              : l,
                          ),
                        })
                      }
                    />
                    <select
                      className={softSelect}
                      value={line.taxCodeId}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, i) =>
                            i === idx
                              ? {
                                  ...l,
                                  taxCodeId: e.target.value,
                                  vatSource: "manual",
                                }
                              : l,
                          ),
                        })
                      }
                    >
                      <option value="">TVA…</option>
                      {taxCodes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {formatRateBps(c.currentRateBps)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {line.vatSource === "stub" ? (
                    <p className="text-[length:var(--a-text-xs)] text-a-warning">
                      Stub TVA19 — à valider avec le comptable (pas
                      FODEC/timbre).
                    </p>
                  ) : line.vatSource === "product" ? (
                    <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                      TVA reprise de la fiche produit.
                    </p>
                  ) : null}
                </div>
              ))}

              <label className="flex items-center gap-2 text-[length:var(--a-text-sm)]">
                <input
                  type="checkbox"
                  checked={form.issue}
                  onChange={(e) =>
                    setForm({ ...form, issue: e.target.checked })
                  }
                />
                Émettre immédiatement (crée la créance AR sur TTC)
              </label>
            </AFormSection>

            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
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
                disabled={busy}
                onClick={() => void submit()}
              >
                Créer
              </AButton>
            </div>
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}
