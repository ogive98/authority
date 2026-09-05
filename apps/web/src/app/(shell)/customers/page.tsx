"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  STATUS_LABELS,
  addCustomerContact,
  archiveCustomer,
  blockCustomer,
  createCustomer,
  fetchCustomer,
  fetchCustomerZones,
  fetchCustomers,
  setCustomerCredit,
  unblockCustomer,
  updateCustomer,
  type Customer,
  type CustomerZone,
} from "@/lib/customers";

const selectClass =
  "flex h-9 w-full rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-3 text-[length:var(--a-text-sm)] text-a-fg";

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
  contactName: string;
  contactPhone: string;
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
      contactName: "",
      contactPhone: "",
      contactEmail: "",
    }),
    [],
  );

  const loadZones = useCallback(async () => {
    const res = await fetchCustomerZones();
    if (res.ok) setZones(res.data);
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
    setDrawerOpen(true);
  }

  async function openEdit(row: Customer) {
    setFormError(null);
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
      contactName: "",
      contactPhone: "",
      contactEmail: "",
    });
    setDrawerOpen(true);
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

  return (
    <>
      <AScreenHeader
        kicker="Clients"
        title="Clients"
        description="Fiches liées party (master data) + contacts, zones et crédit."
        actions={
          <AButton type="button" size="sm" onClick={openCreate}>
            Nouveau client
          </AButton>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label
              htmlFor="cus-q"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Recherche
            </label>
            <AInput
              id="cus-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Code ou raison sociale"
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
            title="Aucun client"
            description="Créez la première fiche client."
            actionLabel="Nouveau client"
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--a-radius-md)] border border-a-border-subtle">
            <table className="w-full min-w-[44rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="border-b border-a-border-subtle bg-a-surface-2 text-a-fg-muted">
                <tr>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Code
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Surnom
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Raison sociale
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Zone
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Crédit
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
                      <button
                        type="button"
                        className="text-left text-a-accent hover:underline"
                        onClick={() => void openEdit(row)}
                      >
                        {row.code}
                      </button>
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] text-a-fg-muted">
                      {row.nickname ?? "—"}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.legalName}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] text-a-fg-muted">
                      {row.zoneCode ?? "—"}
                    </td>
                    <td className="a-mono px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.creditLimit ?? "—"}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.blocked ? (
                        <ABadge tone="danger">Bloqué</ABadge>
                      ) : (
                        <ABadge tone="success">
                          {STATUS_LABELS[row.status]}
                        </ABadge>
                      )}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      <div className="flex flex-wrap gap-2">
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
            <Field label="Zone">
              <select
                className={selectClass}
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

            {editing?.blocked ? (
              <p className="text-[length:var(--a-text-sm)] text-[color:var(--a-danger)]">
                Client bloqué
                {editing.blockedReason ? ` — ${editing.blockedReason}` : ""}
              </p>
            ) : null}

            <div className="border-t border-a-border-subtle pt-4">
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
