"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ABadge,
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
import { fetchCustomers } from "@/lib/customers";
import {
  OPEN_ITEM_STATUS_LABELS,
  allocateOpenItem,
  createOpenItem,
  fetchOpenItems,
  openItemBadgeTone,
  type FinOpenItem,
  type OpenItemStatus,
} from "@/lib/finance";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FinOpenItem[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type CreateForm = {
  customerId: string | null;
  customerLabel: string;
  amountTotal: string;
  dueDate: string;
  label: string;
};

type AllocateDraft = {
  id: string;
  number: string;
  amountOpen: string;
  amount: string;
  note: string;
};

const STATUS_FILTERS: Array<{ id: "" | OpenItemStatus; label: string }> = [
  { id: "", label: "Tous" },
  { id: "OPEN", label: "Ouvert" },
  { id: "PARTIAL", label: "Partiel" },
  { id: "CLOSED", label: "Soldé" },
];

export default function FinancePage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | OpenItemStatus>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<CreateForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerOpts, setCustomerOpts] = useState<AComboboxOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [allocateDraft, setAllocateDraft] = useState<AllocateDraft | null>(
    null,
  );
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (query?: string, status?: "" | OpenItemStatus) => {
      setState({ kind: "loading" });
      const res = await fetchOpenItems({
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
    void load(q, statusFilter);
  }, [load, statusFilter]);

  function openCreate() {
    setFormError(null);
    setForm({
      customerId: null,
      customerLabel: "",
      amountTotal: "",
      dueDate: "",
      label: "",
    });
    setCustomerOpts([]);
    setDrawerOpen(true);
  }

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
        hint: c.creditLimit ? `Crédit ${c.creditLimit} TND` : undefined,
      })),
    );
  }, []);

  function scheduleCustomerSearch(text: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void refreshCustomers(text);
    }, 200);
  }

  async function submitCreate() {
    if (!form?.customerId) {
      setFormError("Sélectionnez un client.");
      return;
    }
    const amount = Number(form.amountTotal.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Montant total invalide.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createOpenItem({
      customerId: form.customerId,
      amountTotal: amount,
      dueDate: form.dueDate || undefined,
      label: form.label.trim() || undefined,
      currency: "TND",
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q, statusFilter);
  }

  async function submitAllocate() {
    if (!allocateDraft) return;
    const amount = Number(allocateDraft.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setState({ kind: "error", message: "Montant d’encaissement invalide." });
      return;
    }
    setBusy(true);
    const res = await allocateOpenItem(allocateDraft.id, {
      amount,
      note: allocateDraft.note.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    setAllocateDraft(null);
    await load(q, statusFilter);
  }

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Créances"
        description="Open items AR — montants enregistrés tels quels (pas de calcul TVA)."
        actions={
          <AButton type="button" size="sm" onClick={openCreate}>
            Nouvelle créance
          </AButton>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((chip) => {
            const active = statusFilter === chip.id;
            return (
              <button
                key={chip.id || "all"}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                className={
                  active
                    ? "rounded-full border border-a-accent bg-a-accent-muted px-3 py-1 text-[length:var(--a-text-xs)] font-medium text-a-accent"
                    : "rounded-full border border-a-border-subtle bg-a-surface-2 px-3 py-1 text-[length:var(--a-text-xs)] text-a-fg-muted hover:border-a-accent/40 hover:text-a-fg"
                }
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label
              htmlFor="fin-q"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Recherche
            </label>
            <AInput
              id="fin-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° / libellé"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q, statusFilter);
              }}
            />
          </div>
          <AButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load(q, statusFilter)}
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
            onRetry={() => void load(q, statusFilter)}
          />
        ) : null}

        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucune créance"
            description="Enregistrez un open item AR avec le montant total tel que facturé — sans inventer de taux TVA."
            actionLabel="Nouvelle créance"
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2">
            <table className="w-full min-w-[52rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="border-b border-a-border-subtle bg-a-surface-3/80 text-a-fg-muted">
                <tr>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Client</th>
                  <th className="a-table-cell font-medium">Libellé</th>
                  <th className="a-table-cell font-medium">Total</th>
                  <th className="a-table-cell font-medium">Ouvert</th>
                  <th className="a-table-cell font-medium">Échéance</th>
                  <th className="a-table-cell font-medium">Statut</th>
                  <th className="a-table-cell font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-a-border-subtle last:border-0 hover:bg-a-surface-3/60"
                  >
                    <td className="a-mono a-table-cell">{row.number}</td>
                    <td className="a-table-cell">
                      {row.customerName ?? row.customerCode ?? "—"}
                    </td>
                    <td className="a-table-cell text-a-fg-muted">
                      {row.label ?? "—"}
                    </td>
                    <td className="a-mono a-table-cell tabular-nums">
                      {row.amountTotal} {row.currency}
                    </td>
                    <td className="a-mono a-table-cell tabular-nums font-medium">
                      {row.amountOpen} {row.currency}
                    </td>
                    <td className="a-mono a-table-cell text-a-fg-muted">
                      {row.dueDate ?? "—"}
                    </td>
                    <td className="a-table-cell">
                      <ABadge tone={openItemBadgeTone(row.status)}>
                        {OPEN_ITEM_STATUS_LABELS[row.status]}
                      </ABadge>
                    </td>
                    <td className="a-table-cell">
                      {row.status !== "CLOSED" ? (
                        <AButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setAllocateDraft({
                              id: row.id,
                              number: row.number,
                              amountOpen: row.amountOpen,
                              amount: row.amountOpen,
                              note: "",
                            })
                          }
                        >
                          Encaisser
                        </AButton>
                      ) : (
                        <span className="text-a-fg-subtle">—</span>
                      )}
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
        title="Nouvelle créance"
        description="Montant total enregistré tel quel — pas de TVA calculée."
      >
        {form ? (
          <div className="space-y-4">
            <ACombobox
              label="Client"
              valueId={form.customerId}
              displayValue={form.customerLabel}
              options={customerOpts}
              loading={customerLoading}
              placeholder="Rechercher un client…"
              onOpen={() => void refreshCustomers(form.customerLabel.trim())}
              onDisplayChange={(text) => {
                setForm({
                  ...form,
                  customerLabel: text,
                  customerId: null,
                });
                scheduleCustomerSearch(text);
              }}
              onSelect={(opt) => {
                setForm({
                  ...form,
                  customerId: opt.id,
                  customerLabel: opt.label,
                });
              }}
            />
            <div className="space-y-1">
              <label
                htmlFor="fin-amount"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Montant total (TND)
              </label>
              <AInput
                id="fin-amount"
                className="a-mono"
                value={form.amountTotal}
                onChange={(e) =>
                  setForm({ ...form, amountTotal: e.target.value })
                }
                placeholder="50.000"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="fin-due"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Échéance
              </label>
              <AInput
                id="fin-due"
                type="date"
                value={form.dueDate}
                onChange={(e) =>
                  setForm({ ...form, dueDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="fin-label"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Libellé
              </label>
              <AInput
                id="fin-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Facture / créance…"
              />
            </div>
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
                onClick={() => void submitCreate()}
              >
                Créer
              </AButton>
            </div>
          </div>
        ) : null}
      </ADrawer>

      <ADrawer
        open={!!allocateDraft}
        onOpenChange={(open) => {
          if (!open) setAllocateDraft(null);
        }}
        title="Encaissement"
        description={
          allocateDraft
            ? `${allocateDraft.number} · ouvert ${allocateDraft.amountOpen} TND`
            : undefined
        }
      >
        {allocateDraft ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="fin-alloc-amount"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Montant encaissé (TND)
              </label>
              <AInput
                id="fin-alloc-amount"
                className="a-mono"
                value={allocateDraft.amount}
                onChange={(e) =>
                  setAllocateDraft({
                    ...allocateDraft,
                    amount: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="fin-alloc-note"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Note
              </label>
              <AInput
                id="fin-alloc-note"
                value={allocateDraft.note}
                onChange={(e) =>
                  setAllocateDraft({
                    ...allocateDraft,
                    note: e.target.value,
                  })
                }
                placeholder="Réf. paiement…"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setAllocateDraft(null)}
              >
                Annuler
              </AButton>
              <AButton
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void submitAllocate()}
              >
                Enregistrer
              </AButton>
            </div>
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}
