"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  allocateOpenItem,
  confirmDunning,
  sendDunning,
  createOpenItem,
  createPromise,
  fetchDunningPreview,
  fetchOpenItems,
  isOpenItemOverdue,
  openItemBadgeTone,
  prepareDunning,
  type FinDunningDraft,
  type DunningChannel,
  type DunningPreview,
  type FinOpenItem,
  type OpenItemStatus,
} from "@/lib/finance";
import {
  softChipClass,
  softPageBody,
  softSelect,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";
import { useStatusLabel } from "@/hooks/use-status-label";

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

type PromiseDraft = {
  id: string;
  number: string;
  amountOpen: string;
  amount: string;
  promisedDate: string;
  notes: string;
};

type FilterMode = "" | OpenItemStatus | "OVERDUE";

export default function FinancePage() {
  const { label: st } = useStatusLabel();
  const STATUS_FILTERS: Array<{ id: FilterMode; label: string }> = [
    { id: "", label: st("ALL", "Tous") },
    { id: "OPEN", label: st("OPEN") },
    { id: "PARTIAL", label: st("PARTIAL") },
    { id: "CLOSED", label: st("CLOSED") },
    { id: "OVERDUE", label: st("OVERDUE", "Échues") },
  ];
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterMode>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<CreateForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerOpts, setCustomerOpts] = useState<AComboboxOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [allocateDraft, setAllocateDraft] = useState<AllocateDraft | null>(
    null,
  );
  const [promiseDraft, setPromiseDraft] = useState<PromiseDraft | null>(null);
  const [dunningPreview, setDunningPreview] = useState<DunningPreview | null>(
    null,
  );
  const [dunningDraft, setDunningDraft] = useState<FinDunningDraft | null>(
    null,
  );
  const [dunningContactId, setDunningContactId] = useState<string | null>(null);
  const [dunningChannel, setDunningChannel] =
    useState<DunningChannel>("EMAIL");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (query?: string, filter?: FilterMode) => {
      setState({ kind: "loading" });
      const overdue = filter === "OVERDUE";
      const res = await fetchOpenItems({
        q: query,
        status: overdue ? undefined : filter || undefined,
        overdue: overdue || undefined,
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

  async function submitPromise() {
    if (!promiseDraft) return;
    const amount = Number(promiseDraft.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Montant de promesse invalide.");
      return;
    }
    if (!promiseDraft.promisedDate) {
      setFormError("Date promise requise.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createPromise({
      openItemId: promiseDraft.id,
      amount,
      promisedDate: promiseDraft.promisedDate,
      notes: promiseDraft.notes.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setPromiseDraft(null);
    await load(q, statusFilter);
  }

  async function openDunning(openItemId: string) {
    setBusy(true);
    setFormError(null);
    const res = await fetchDunningPreview(openItemId);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDunningPreview(res.data);
    setDunningDraft(null);
    const first =
      res.data.contacts.find((c) => c.email) ??
      res.data.contacts.find((c) => c.whatsapp) ??
      res.data.contacts[0] ??
      null;
    setDunningContactId(first?.id ?? null);
    setDunningChannel(
      first?.email ? "EMAIL" : first?.whatsapp ? "WHATSAPP" : "EMAIL",
    );
  }

  async function submitDunningConfirm() {
    if (!dunningPreview || !dunningContactId) return;
    setBusy(true);
    setFormError(null);
    const prepared = await prepareDunning({
      openItemId: dunningPreview.openItemId,
      contactId: dunningContactId,
      channel: dunningChannel,
    });
    if (!prepared.ok) {
      setBusy(false);
      setFormError(prepared.message);
      return;
    }
    const confirmed = await confirmDunning(prepared.data.id);
    setBusy(false);
    if (!confirmed.ok) {
      setFormError(confirmed.message);
      return;
    }
    setDunningDraft(confirmed.data);
  }

  async function submitDunningSend() {
    if (!dunningDraft) return;
    setBusy(true);
    setFormError(null);
    const res = await sendDunning(dunningDraft.id);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDunningDraft(res.data);
    if (res.data.sendStatus === "FAILED" && res.data.sendError) {
      setFormError(res.data.sendError);
    }
  }

  function openDunningFallback(draft: FinDunningDraft) {
    if (draft.channel === "EMAIL" && draft.mailtoHref) {
      window.location.href = draft.mailtoHref;
    } else if (draft.channel === "WHATSAPP" && draft.waMeHref) {
      window.open(draft.waMeHref, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Créances"
        description="Open items AR — montants enregistrés tels quels (pas de calcul TVA). Relance = mailto / WhatsApp (humain)."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/finance/invoices"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              Factures
            </Link>
            <Link
              href="/finance/credit-notes"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              Avoirs
            </Link>
            <Link
              href="/finance/payments"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              Encaissements
            </Link>
            <Link
              href="/finance/promises"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              Promesses
            </Link>
            <Link
              href="/finance/banking"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              Banque
            </Link>
            <AButton type="button" size="sm" onClick={openCreate}>
              Nouvelle créance
            </AButton>
          </div>
        }
      />
      <div className={softPageBody}>
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Filtrer par statut"
        >
          {STATUS_FILTERS.map((chip) => {
            const active = statusFilter === chip.id;
            return (
              <button
                key={chip.id || "all"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(chip.id)}
                className={softChipClass(active)}
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
          <div className={softTableWrap}>
            <table className="w-full min-w-[52rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
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
                  <tr key={row.id} className={softTr}>
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
                      {isOpenItemOverdue(row) ? (
                        <span className="ml-2 inline-block">
                          <ABadge tone="warning">{st("OVERDUE")}</ABadge>
                        </span>
                      ) : null}
                    </td>
                    <td className="a-table-cell">
                      <ABadge tone={openItemBadgeTone(row.status)}>
                        {st(row.status)}
                      </ABadge>
                    </td>
                    <td className="a-table-cell">
                      {row.status !== "CLOSED" ? (
                        <div className="flex flex-wrap gap-2">
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
                          <AButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const in7 = new Date();
                              in7.setUTCDate(in7.getUTCDate() + 7);
                              setPromiseDraft({
                                id: row.id,
                                number: row.number,
                                amountOpen: row.amountOpen,
                                amount: row.amountOpen,
                                promisedDate: in7.toISOString().slice(0, 10),
                                notes: "",
                              });
                              setFormError(null);
                            }}
                          >
                            Promesse
                          </AButton>
                          {isOpenItemOverdue(row) ? (
                            <AButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              onClick={() => void openDunning(row.id)}
                            >
                              Relancer
                            </AButton>
                          ) : null}
                        </div>
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

      <ADrawer
        open={!!promiseDraft}
        onOpenChange={(open) => {
          if (!open) setPromiseDraft(null);
        }}
        title="Promesse de paiement"
        description={
          promiseDraft
            ? `${promiseDraft.number} · ouvert ${promiseDraft.amountOpen} TND`
            : undefined
        }
      >
        {promiseDraft ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="fin-ptp-amount"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Montant promis (TND)
              </label>
              <AInput
                id="fin-ptp-amount"
                className="a-mono"
                value={promiseDraft.amount}
                onChange={(e) =>
                  setPromiseDraft({
                    ...promiseDraft,
                    amount: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="fin-ptp-date"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Date promise
              </label>
              <AInput
                id="fin-ptp-date"
                type="date"
                className="a-mono"
                value={promiseDraft.promisedDate}
                onChange={(e) =>
                  setPromiseDraft({
                    ...promiseDraft,
                    promisedDate: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="fin-ptp-notes"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Note
              </label>
              <AInput
                id="fin-ptp-notes"
                value={promiseDraft.notes}
                onChange={(e) =>
                  setPromiseDraft({
                    ...promiseDraft,
                    notes: e.target.value,
                  })
                }
                placeholder="Engagement client…"
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
                onClick={() => setPromiseDraft(null)}
              >
                Annuler
              </AButton>
              <AButton
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void submitPromise()}
              >
                Enregistrer
              </AButton>
            </div>
          </div>
        ) : null}
      </ADrawer>

      <ADrawer
        open={Boolean(dunningPreview)}
        onOpenChange={(open) => {
          if (!open) {
            setDunningPreview(null);
            setDunningDraft(null);
          }
        }}
        title="Préparer relance"
        description="Confirmer, puis Envoyer (SMTP / WA Cloud) ou ouvrir mailto / wa.me."
      >
        {dunningPreview ? (
          <div className="space-y-4">
            <div className="a-underlay rounded-md p-3 space-y-1">
              <p className="a-mono text-[length:var(--a-text-sm)]">
                {dunningPreview.number} · {dunningPreview.amountOpen}{" "}
                {dunningPreview.currency}
              </p>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                {dunningPreview.customerName ?? "—"} · échéance{" "}
                {dunningPreview.dueDate ?? "—"} · J+
                {dunningPreview.daysPastDue}
                {dunningPreview.milestoneDay != null
                  ? ` · jalon J+${dunningPreview.milestoneDay}`
                  : ""}
              </p>
            </div>

            {!dunningPreview.eligible ? (
              <p className="text-[length:var(--a-text-sm)] text-a-warning">
                {dunningPreview.blockReason ?? "Non éligible."}
                {dunningPreview.hasOpenPromise
                  ? " (promesse OPEN active)"
                  : ""}
              </p>
            ) : null}

            {!dunningDraft ? (
              <>
                <div className="space-y-1">
                  <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                    Contact
                  </label>
                  <select
                    className={softSelect}
                    value={dunningContactId ?? ""}
                    onChange={(e) =>
                      setDunningContactId(e.target.value || null)
                    }
                    disabled={!dunningPreview.eligible}
                  >
                    <option value="">— choisir —</option>
                    {dunningPreview.contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.email ? ` · ${c.email}` : ""}
                        {c.whatsapp ? ` · WA ${c.whatsapp}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={softChipClass(dunningChannel === "EMAIL")}
                    onClick={() => setDunningChannel("EMAIL")}
                    disabled={!dunningPreview.eligible}
                  >
                    Email
                  </button>
                  <button
                    type="button"
                    className={softChipClass(dunningChannel === "WHATSAPP")}
                    onClick={() => setDunningChannel("WHATSAPP")}
                    disabled={!dunningPreview.eligible}
                  >
                    WhatsApp
                  </button>
                </div>

                <div className="space-y-1">
                  <p className="text-[length:var(--a-text-sm)] font-medium">
                    {dunningPreview.subject}
                  </p>
                  <pre className="a-underlay max-h-48 overflow-auto whitespace-pre-wrap rounded-md p-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
                    {dunningPreview.body}
                  </pre>
                </div>
              </>
            ) : (
              <div className="a-underlay rounded-md p-3 space-y-2">
                <p className="text-[length:var(--a-text-sm)] text-a-fg">
                  Confirmé · {dunningDraft.number} → {dunningDraft.recipient}
                </p>
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Envoi :{" "}
                  {dunningDraft.sendStatus === "SENT"
                    ? "envoyé"
                    : dunningDraft.sendStatus === "FAILED"
                      ? "échec"
                      : "non envoyé"}
                  {dunningDraft.channel === "WHATSAPP" &&
                  dunningDraft.waDeliveryStatus &&
                  dunningDraft.waDeliveryStatus !== "NONE"
                    ? ` · livraison ${
                        dunningDraft.waDeliveryStatus === "SENT"
                          ? "envoyée Meta"
                          : dunningDraft.waDeliveryStatus === "DELIVERED"
                            ? "livrée"
                            : dunningDraft.waDeliveryStatus === "READ"
                              ? "lue"
                              : "échec"
                      }`
                    : ""}
                  {dunningDraft.channelConfigured
                    ? " · canal Prefs prêt"
                    : " · canal Prefs non configuré"}
                </p>
                {dunningDraft.sendError ? (
                  <p className="text-[length:var(--a-text-xs)] text-a-danger">
                    {dunningDraft.sendError}
                  </p>
                ) : null}
                {dunningDraft.waDeliveryError ? (
                  <p className="text-[length:var(--a-text-xs)] text-a-danger">
                    Livraison WA : {dunningDraft.waDeliveryError}
                  </p>
                ) : null}
              </div>
            )}

            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDunningPreview(null);
                  setDunningDraft(null);
                }}
              >
                Fermer
              </AButton>
              {!dunningDraft ? (
                <AButton
                  type="button"
                  size="sm"
                  disabled={
                    busy ||
                    !dunningPreview.eligible ||
                    !dunningContactId
                  }
                  onClick={() => void submitDunningConfirm()}
                >
                  Confirmer
                </AButton>
              ) : (
                <>
                  {dunningDraft.sendStatus !== "SENT" &&
                  dunningDraft.channelConfigured ? (
                    <AButton
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void submitDunningSend()}
                    >
                      {dunningDraft.channel === "EMAIL"
                        ? "Envoyer SMTP"
                        : "Envoyer WA Cloud"}
                    </AButton>
                  ) : null}
                  <AButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => openDunningFallback(dunningDraft)}
                  >
                    {dunningDraft.channel === "EMAIL"
                      ? "Ouvrir mailto"
                      : "Ouvrir wa.me"}
                  </AButton>
                </>
              )}
            </div>
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}
