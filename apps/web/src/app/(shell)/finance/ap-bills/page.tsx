"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  ABadge,
  AButton,
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
  ATabs,
  erpListDescription,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import {
  AP_BILL_STATUS_FILTERS,
  AP_BILL_STATUS_LABELS,
  apBillBadgeTone,
  createApBill,
  fetchApBills,
  type ApBillStatus,
  type FinApBill,
} from "@/lib/finance";
import { softSelect } from "@/lib/soft-glass-ui";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import { fetchSuppliers, type Supplier } from "@/lib/suppliers";
import { fetchTaxCodes, type TaxCode } from "@/lib/tax";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FinApBill[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FormState = {
  supplierId: string;
  vendorName: string;
  amountTotal: string;
  amountHt: string;
  taxCodeId: string;
  billDate: string;
  dueDate: string;
  label: string;
  reference: string;
  notes: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function FinanceApBillsPage() {
  return (
    <Suspense
      fallback={
        <APageBody>
          <ASkeleton className="h-10 w-48" />
          <ASkeleton className="h-10 w-full" />
        </APageBody>
      }
    >
      <FinanceApBillsPageInner />
    </Suspense>
  );
}

function FinanceApBillsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ApBillStatus>(() => {
    const s = searchParams.get("status");
    if (s === "DRAFT" || s === "POSTED" || s === "CANCELLED") return s;
    return "";
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const axPrefillDone = useRef(false);

  const load = useCallback(
    async (query?: string, status?: "" | ApBillStatus) => {
      setState({ kind: "loading" });
      const res = await fetchApBills({
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
    void (async () => {
      const [sup, tax] = await Promise.all([fetchSuppliers(), fetchTaxCodes()]);
      if (sup.ok) setSuppliers(sup.data.items);
      if (tax.ok) setTaxCodes(tax.data.items.filter((c) => c.kind === "VAT"));
    })();
    // initial hydrate only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  function syncStatusUrl(next: "" | ApBillStatus) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set("status", next);
    else sp.delete("status");
    const qs = sp.toString();
    router.replace(qs ? `/finance/ap-bills?${qs}` : "/finance/ap-bills", {
      scroll: false,
    });
  }

  useEffect(() => {
    const s = searchParams.get("status");
    const next: "" | ApBillStatus =
      s === "DRAFT" || s === "POSTED" || s === "CANCELLED" ? s : "";
    if (next !== statusFilter) {
      setStatusFilter(next);
      void load(q, next);
    }
    // sync from URL only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /** AUTHORITY X / Thunder prepare — open create drawer with prefill (human still submits) */
  useEffect(() => {
    if (axPrefillDone.current) return;
    const create = searchParams.get("create");
    const source = searchParams.get("source");
    if (create !== "1" && source !== "authority_x") return;
    // Wait for suppliers list when UUID supplierId is present
    const supplierId = searchParams.get("supplierId")?.trim() ?? "";
    if (supplierId && suppliers.length === 0) return;

    const amount = searchParams.get("amount")?.trim() ?? "";
    const vendorName = searchParams.get("vendorName")?.trim() ?? "";
    const match = supplierId
      ? suppliers.find((s) => s.id === supplierId)
      : undefined;

    axPrefillDone.current = true;
    setFormError(null);
    setForm({
      supplierId: match?.id ?? "",
      vendorName: match?.legalName ?? vendorName,
      amountTotal: amount,
      amountHt: "",
      taxCodeId: "",
      billDate: todayIso(),
      dueDate: "",
      label: source === "authority_x" ? "AUTHORITY X" : "",
      reference: "",
      notes:
        source === "authority_x"
          ? "Prérempli depuis AUTHORITY X — confirmer avant enregistrement."
          : "",
    });
    setDrawerOpen(true);

    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("create");
    const qs = sp.toString();
    router.replace(qs ? `/finance/ap-bills?${qs}` : "/finance/ap-bills", {
      scroll: false,
    });
  }, [searchParams, suppliers, router]);

  function openCreate() {
    setFormError(null);
    setForm({
      supplierId: "",
      vendorName: "",
      amountTotal: "",
      amountHt: "",
      taxCodeId: "",
      billDate: todayIso(),
      dueDate: "",
      label: "",
      reference: "",
      notes: "",
    });
    setDrawerOpen(true);
  }

  async function submit() {
    if (!form) return;
    const vendorName = form.vendorName.trim();
    const supplierId = form.supplierId.trim() || undefined;
    const amountHt = Number(form.amountHt.replace(",", "."));
    const amountTotal = Number(form.amountTotal.replace(",", "."));
    if (!vendorName && !supplierId) {
      setFormError("Choisissez un fournisseur master ou saisissez un nom libre.");
      return;
    }
    const useTax = Number.isFinite(amountHt) && amountHt > 0;
    if (!useTax && (!Number.isFinite(amountTotal) || amountTotal <= 0)) {
      setFormError("Montant TTC ou HT (TVA) doit être > 0.");
      return;
    }
    if (!form.billDate) {
      setFormError("Date de facture requise.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createApBill({
      vendorName: vendorName || undefined,
      supplierId,
      ...(useTax
        ? {
            lines: [
              {
                amountHt,
                taxCodeId: form.taxCodeId || undefined,
                description: form.label.trim() || vendorName || "AP",
              },
            ],
          }
        : { amountTotal }),
      billDate: form.billDate,
      dueDate: form.dueDate || undefined,
      label: form.label.trim() || undefined,
      reference: form.reference.trim() || undefined,
      notes: form.notes.trim() || undefined,
      currency: "TND",
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    router.push(`/finance/ap-bills/${res.data.id}`);
  }

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Factures fournisseurs"
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "HT+TVA optionnel · TTC sinon · RAS si Prefs VALIDATED · GL Thunder",
        )}
        primary={
          <AButton type="button" size="sm" onClick={openCreate}>
            {LAYOUT_ACTIONS.newApBill}
          </AButton>
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "banking",
                label: "Banque / décaissements",
                onSelect: () => router.push("/finance/banking"),
              },
              {
                id: "invoices",
                label: "Factures clients",
                onSelect: () => router.push("/finance/invoices"),
              },
              {
                id: "prefs",
                label: "Préférences Expertise",
                onSelect: () => router.push("/settings#expertise"),
              },
            ]}
          />
        }
      />
      <APageBody>
        <ExpertiseHintsStrip keys={["tax.ras", "tax.tej"]} />
        <AFilterBar
          search={
            <AInput
              id="apb-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° / fournisseur / réf."
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
                const next = (id === "all" ? "" : id) as "" | ApBillStatus;
                setStatusFilter(next);
                syncStatusUrl(next);
                void load(q, next);
              }}
              items={AP_BILL_STATUS_FILTERS.map((chip) => ({
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
            title="Aucune facture fournisseur"
            description="Créez une facture AP en texte libre — référentiel fournisseurs plus tard."
            actionLabel={LAYOUT_ACTIONS.newApBill}
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <ASoftTable>
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>N°</ASoftTh>
                <ASoftTh>Fournisseur</ASoftTh>
                <ASoftTh>Date</ASoftTh>
                <ASoftTh>Échéance</ASoftTh>
                <ASoftTh numeric>Montant</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((bill) => (
                <ASoftTr
                  key={bill.id}
                  onClick={() => router.push(`/finance/ap-bills/${bill.id}`)}
                >
                  <ASoftTd>
                    <Link
                      href={`/finance/ap-bills/${bill.id}`}
                      className="a-mono font-semibold text-a-accent hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {bill.number}
                    </Link>
                  </ASoftTd>
                  <ASoftTd>{bill.vendorName}</ASoftTd>
                  <ASoftTd className="a-mono text-a-fg-muted">
                    {bill.billDate}
                  </ASoftTd>
                  <ASoftTd className="a-mono text-a-fg-muted">
                    {bill.dueDate ?? "—"}
                  </ASoftTd>
                  <ASoftTd numeric>
                    {bill.amountTotal} {bill.currency}
                  </ASoftTd>
                  <ASoftTd>
                    <ABadge tone={apBillBadgeTone(bill.status)}>
                      {AP_BILL_STATUS_LABELS[bill.status]}
                    </ABadge>
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
        title="Nouvelle facture fournisseur"
        description="Master `/suppliers` optionnel. HT + code TVA (stub TVA19) ou TTC sans TVA. Poster freeze tax_line (D276)."
      >
        {form ? (
          <div className="space-y-5">
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}

            <AFormSection title="Fournisseur">
              {suppliers.length > 0 ? (
                <AField label="Fournisseur (master)">
                  <select
                    className={softSelect}
                    value={form.supplierId}
                    onChange={(e) => {
                      const supplierId = e.target.value;
                      const match = suppliers.find((s) => s.id === supplierId);
                      setForm({
                        ...form,
                        supplierId,
                        vendorName: match
                          ? match.legalName
                          : form.vendorName,
                      });
                    }}
                  >
                    <option value="">— Texte libre —</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.legalName}
                      </option>
                    ))}
                  </select>
                </AField>
              ) : null}
              <AField label="Nom affiché" required>
                <AInput
                  value={form.vendorName}
                  onChange={(e) =>
                    setForm({ ...form, vendorName: e.target.value })
                  }
                  placeholder="Ex. Laiterie Nord"
                />
              </AField>
            </AFormSection>

            <AFormSection title="Montants">
              <AField label="Montant HT TND (TVA)">
                <AInput
                  value={form.amountHt}
                  onChange={(e) =>
                    setForm({ ...form, amountHt: e.target.value })
                  }
                  inputMode="decimal"
                  placeholder="vide = TTC seul"
                />
              </AField>
              {form.amountHt.trim() ? (
                <AField label="Code TVA">
                  <select
                    className={softSelect}
                    value={form.taxCodeId}
                    onChange={(e) =>
                      setForm({ ...form, taxCodeId: e.target.value })
                    }
                  >
                    <option value="">TVA19 stub si dispo</option>
                    {taxCodes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.label}
                      </option>
                    ))}
                  </select>
                </AField>
              ) : (
                <AField label="Montant total TTC TND" required>
                  <AInput
                    value={form.amountTotal}
                    onChange={(e) =>
                      setForm({ ...form, amountTotal: e.target.value })
                    }
                    inputMode="decimal"
                    placeholder="0.000"
                  />
                </AField>
              )}
            </AFormSection>

            <AFormSection title="Dates & références">
              <div className="grid grid-cols-2 gap-3">
                <AField label="Date facture" required>
                  <AInput
                    type="date"
                    value={form.billDate}
                    onChange={(e) =>
                      setForm({ ...form, billDate: e.target.value })
                    }
                  />
                </AField>
                <AField label="Échéance">
                  <AInput
                    type="date"
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm({ ...form, dueDate: e.target.value })
                    }
                  />
                </AField>
              </div>
              <AField label="Libellé">
                <AInput
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </AField>
              <AField label="Référence externe">
                <AInput
                  value={form.reference}
                  onChange={(e) =>
                    setForm({ ...form, reference: e.target.value })
                  }
                />
              </AField>
              <AField label="Notes">
                <AInput
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </AField>
            </AFormSection>

            <div className="flex justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="ghost"
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
                onClick={() => void submit()}
              >
                {LAYOUT_ACTIONS.save}
              </AButton>
            </div>
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}
