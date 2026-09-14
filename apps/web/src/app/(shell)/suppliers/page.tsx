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
  APageBody,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftThead,
  ASoftTr,
  ASwitch,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { softSelect } from "@/lib/soft-glass-ui";
import {
  SUPPLIER_CATEGORY_LABELS,
  SUPPLIER_STATUS_LABELS,
  createSupplier,
  fetchSuppliers,
  type Supplier,
  type SupplierCategory,
} from "@/lib/suppliers";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: Supplier[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FormState = {
  code: string;
  legalName: string;
  taxId: string;
  category: SupplierCategory;
  leadTimeDays: string;
  moqDefault: string;
  preferred: boolean;
  paymentTerms: string;
  notes: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

const CATEGORIES = Object.keys(
  SUPPLIER_CATEGORY_LABELS,
) as SupplierCategory[];

function statusTone(
  s: Supplier["status"],
): "success" | "warning" | "danger" | "neutral" {
  if (s === "ACTIVE") return "success";
  if (s === "ON_HOLD") return "warning";
  if (s === "BLOCKED") return "danger";
  return "neutral";
}

export default function SuppliersPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emptyForm = useCallback(
    (): FormState => ({
      code: "",
      legalName: "",
      taxId: "",
      category: "FOURNITURE",
      leadTimeDays: "",
      moqDefault: "",
      preferred: false,
      paymentTerms: "",
      notes: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
    }),
    [],
  );

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const res = await fetchSuppliers(query);
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
  }, [load]);

  function openCreate() {
    setForm(emptyForm());
    setFormError(null);
    setDrawerOpen(true);
  }

  async function onSave() {
    if (!form) return;
    setBusy(true);
    setFormError(null);
    try {
      const lead = form.leadTimeDays.trim();
      const moq = form.moqDefault.trim();
      const contacts =
        form.contactName.trim().length > 0
          ? [
              {
                name: form.contactName.trim(),
                phone: form.contactPhone.trim() || undefined,
                email: form.contactEmail.trim() || undefined,
                isPrimary: true,
              },
            ]
          : undefined;
      const res = await createSupplier({
        code: form.code.trim(),
        legalName: form.legalName.trim(),
        taxId: form.taxId.trim() || undefined,
        category: form.category,
        leadTimeDays: lead ? Number(lead) : undefined,
        moqDefault: moq ? Number(moq) : undefined,
        preferred: form.preferred,
        paymentTerms: form.paymentTerms.trim() || undefined,
        notes: form.notes.trim() || undefined,
        contacts,
      });
      if (!res.ok) {
        setFormError(res.message);
        return;
      }
      setDrawerOpen(false);
      await load(q);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AScreenHeader
        kicker="Fournisseurs"
        title="Master fournisseurs"
        description="Catégorie, délai, MOQ · pas de commandes ni prix (D250)."
        primary={
          <AButton type="button" size="sm" onClick={openCreate}>
            {LAYOUT_ACTIONS.newSupplier}
          </AButton>
        }
      />
      <APageBody>
        <AFilterBar
          search={
            <AInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Code ou raison sociale…"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q);
              }}
            />
          }
          utilities={
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void load(q)}
            >
              Filtrer
            </AButton>
          }
        />

        {state.kind === "loading" && <ASkeleton className="h-40 w-full" />}
        {state.kind === "forbidden" && (
          <AForbiddenState message={state.message} />
        )}
        {state.kind === "error" && <AErrorState message={state.message} />}
        {state.kind === "ok" && state.items.length === 0 && (
          <AEmptyState
            title="Aucun fournisseur"
            description="Créez le premier master pour lier les factures AP."
            actionLabel={LAYOUT_ACTIONS.newSupplier}
            onAction={openCreate}
          />
        )}
        {state.kind === "ok" && state.items.length > 0 && (
          <ASoftTable>
            <ASoftThead>
              <tr>
                <th>Code</th>
                <th>Raison sociale</th>
                <th>Catégorie</th>
                <th>Délai</th>
                <th>MOQ</th>
                <th>Statut</th>
                <th />
              </tr>
            </ASoftThead>
            <tbody>
              {state.items.map((row) => (
                <ASoftTr key={row.id}>
                  <td className="font-medium tabular-nums">
                    <Link
                      href={`/suppliers/${row.id}`}
                      className="text-a-accent underline-offset-2 hover:underline"
                    >
                      {row.code}
                    </Link>
                  </td>
                  <td>
                    {row.legalName}
                    {row.preferred ? (
                      <span className="ml-2 text-[length:var(--a-text-xs)] text-a-fg-muted">
                        préféré
                      </span>
                    ) : null}
                    {row.qualityHold ? (
                      <ABadge tone="warning" className="ml-2">
                        Hold qualité
                      </ABadge>
                    ) : null}
                  </td>
                  <td>{SUPPLIER_CATEGORY_LABELS[row.category]}</td>
                  <td className="tabular-nums">
                    {row.leadTimeDays != null
                      ? `${row.leadTimeDays} j`
                      : "—"}
                  </td>
                  <td className="tabular-nums">{row.moqDefault ?? "—"}</td>
                  <td>
                    <ABadge tone={statusTone(row.status)}>
                      {SUPPLIER_STATUS_LABELS[row.status]}
                    </ABadge>
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/suppliers/${row.id}`}
                      className="text-[length:var(--a-text-sm)] text-a-fg-muted underline-offset-2 hover:underline"
                    >
                      Fiche
                    </Link>
                  </td>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        )}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nouveau fournisseur"
      >
        {form && (
          <div className="space-y-3">
            {formError && (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            )}
            <Field label="Code">
              <AInput
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </Field>
            <Field label="Raison sociale">
              <AInput
                value={form.legalName}
                onChange={(e) =>
                  setForm({ ...form, legalName: e.target.value })
                }
              />
            </Field>
            <Field label="Matricule fiscal">
              <AInput
                value={form.taxId}
                onChange={(e) =>
                  setForm({ ...form, taxId: e.target.value })
                }
              />
            </Field>
            <Field label="Catégorie">
              <select
                className={softSelect}
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as SupplierCategory,
                  })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {SUPPLIER_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Délai (jours)">
                <AInput
                  value={form.leadTimeDays}
                  onChange={(e) =>
                    setForm({ ...form, leadTimeDays: e.target.value })
                  }
                />
              </Field>
              <Field label="MOQ défaut">
                <AInput
                  value={form.moqDefault}
                  onChange={(e) =>
                    setForm({ ...form, moqDefault: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Conditions de paiement">
              <AInput
                value={form.paymentTerms}
                onChange={(e) =>
                  setForm({ ...form, paymentTerms: e.target.value })
                }
              />
            </Field>
            <label className="flex items-center gap-2 text-[length:var(--a-text-sm)]">
              <ASwitch
                checked={form.preferred}
                onCheckedChange={(v) =>
                  setForm({ ...form, preferred: v })
                }
              />
              Fournisseur préféré
            </label>
            <Field label="Contact (optionnel)">
              <AInput
                placeholder="Nom"
                value={form.contactName}
                onChange={(e) =>
                  setForm({ ...form, contactName: e.target.value })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <AInput
                placeholder="Téléphone"
                value={form.contactPhone}
                onChange={(e) =>
                  setForm({ ...form, contactPhone: e.target.value })
                }
              />
              <AInput
                placeholder="E-mail"
                value={form.contactEmail}
                onChange={(e) =>
                  setForm({ ...form, contactEmail: e.target.value })
                }
              />
            </div>
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
                disabled={busy || !form.code.trim() || !form.legalName.trim()}
                onClick={() => void onSave()}
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
