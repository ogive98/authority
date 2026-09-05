"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
  ASwitch,
} from "@/components/a";
import {
  STATUS_LABELS,
  activateProduct,
  archiveProduct,
  createProduct,
  fetchProducts,
  fetchRefs,
  updateProduct,
  type Product,
  type RefValue,
} from "@/lib/products";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: Product[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FormState = {
  sku: string;
  name: string;
  typeKey: string;
  uom: string;
  trackLot: boolean;
  perishable: boolean;
  storageClassKey: string;
  allergenFlags: string;
};

const selectClass =
  "flex h-9 w-full rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-3 text-[length:var(--a-text-sm)] text-a-fg";

export default function ProductsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [types, setTypes] = useState<RefValue[]>([]);
  const [uoms, setUoms] = useState<RefValue[]>([]);
  const [storages, setStorages] = useState<RefValue[]>([]);
  const [allergens, setAllergens] = useState<RefValue[]>([]);

  const typeLabel = useMemo(() => {
    const m = new Map(types.map((t) => [t.code, t.label]));
    return (code: string) => m.get(code) ?? code;
  }, [types]);

  const storageLabel = useMemo(() => {
    const m = new Map(storages.map((t) => [t.code, t.label]));
    return (code: string) => m.get(code) ?? code;
  }, [storages]);

  const emptyForm = useCallback((): FormState => {
    return {
      sku: "",
      name: "",
      typeKey: types[0]?.code ?? "",
      uom: uoms[0]?.code ?? "",
      trackLot: false,
      perishable: false,
      storageClassKey: storages[0]?.code ?? "",
      allergenFlags: "",
    };
  }, [types, uoms, storages]);

  const loadRefs = useCallback(async () => {
    const [t, u, s, a] = await Promise.all([
      fetchRefs("product_type"),
      fetchRefs("uom"),
      fetchRefs("storage_class"),
      fetchRefs("allergen"),
    ]);
    if (t.ok) setTypes(t.items);
    if (u.ok) setUoms(u.items);
    if (s.ok) setStorages(s.items);
    if (a.ok) setAllergens(a.items);
  }, []);

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const res = await fetchProducts(query);
    if (!res.ok) {
      if (res.status === 403) {
        setState({
          kind: "forbidden",
          message:
            res.code === "MOD.DISABLED"
              ? "Module Products désactivé pour cette société."
              : "Permission products.read manquante.",
        });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({ kind: "ok", items: res.data.items });
  }, []);

  useEffect(() => {
    void loadRefs();
    void load();
  }, [load, loadRefs]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(row: Product) {
    setEditing(row);
    setForm({
      sku: row.sku,
      name: row.name,
      typeKey: row.typeKey,
      uom: row.uom,
      trackLot: row.trackLot,
      perishable: row.perishable,
      storageClassKey: row.storageClassKey,
      allergenFlags: row.allergenFlags.join(", "),
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  async function submitForm() {
    if (!form) return;
    setBusy(true);
    setFormError(null);
    const allergenList = form.allergenFlags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      sku: form.sku.trim(),
      name: form.name.trim(),
      typeKey: form.typeKey,
      uom: form.uom,
      trackLot: form.trackLot,
      perishable: form.perishable,
      storageClassKey: form.storageClassKey,
      allergenFlags: allergenList,
    };
    const res = editing
      ? await updateProduct(editing.id, {
          ...payload,
          version: editing.version,
        })
      : await createProduct(payload);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q);
  }

  async function onActivate(row: Product) {
    const res = await activateProduct(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  async function onArchive(row: Product) {
    const res = await archiveProduct(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  return (
    <>
      <AScreenHeader
        kicker="Produits"
        title="Catalogue"
        description="Listes paramétrables par société (industry pack)."
        actions={
          <AButton type="button" size="sm" onClick={openCreate}>
            Nouveau produit
          </AButton>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label
              htmlFor="prd-q"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Recherche
            </label>
            <AInput
              id="prd-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="SKU ou nom"
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
            title="Aucun produit"
            description="Créez le premier article du catalogue."
            actionLabel="Nouveau produit"
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--a-radius-md)] border border-a-border-subtle">
            <table className="w-full min-w-[40rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="border-b border-a-border-subtle bg-a-surface-2 text-a-fg-muted">
                <tr>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    SKU
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Nom
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Type
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    UoM
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Stockage
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
                        onClick={() => openEdit(row)}
                      >
                        {row.sku}
                      </button>
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.name}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] text-a-fg-muted">
                      {typeLabel(row.typeKey)}
                    </td>
                    <td className="a-mono px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.uom}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] text-a-fg-muted">
                      {storageLabel(row.storageClassKey)}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      <span
                        className={
                          row.status === "ACTIVE"
                            ? "text-a-success"
                            : row.status === "DRAFT"
                              ? "text-a-fg-muted"
                              : "text-a-warning"
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
                            variant="secondary"
                            onClick={() => void onActivate(row)}
                          >
                            Activer
                          </AButton>
                        ) : null}
                        <AButton
                          type="button"
                          size="sm"
                          variant="secondary"
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
        title={editing ? "Modifier le produit" : "Nouveau produit"}
        description="Référentiels société (industry pack)"
        footer={
          <div className="flex justify-end gap-2">
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
              onClick={() => void submitForm()}
            >
              {busy ? "…" : "Enregistrer"}
            </AButton>
          </div>
        }
      >
        {form ? (
          <div className="space-y-4 p-4">
            <Field label="SKU" htmlFor="prd-sku">
              <AInput
                id="prd-sku"
                value={form.sku}
                disabled={Boolean(editing)}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, sku: e.target.value } : f))
                }
                required
              />
            </Field>
            <Field label="Nom" htmlFor="prd-name">
              <AInput
                id="prd-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, name: e.target.value } : f))
                }
                required
              />
            </Field>
            <Field label="Type" htmlFor="prd-type">
              <select
                id="prd-type"
                className={selectClass}
                value={form.typeKey}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, typeKey: e.target.value } : f))
                }
              >
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unité" htmlFor="prd-uom">
              <select
                id="prd-uom"
                className={selectClass}
                value={form.uom}
                onChange={(e) =>
                  setForm((f) => (f ? { ...f, uom: e.target.value } : f))
                }
              >
                {uoms.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Classe de stockage" htmlFor="prd-storage">
              <select
                id="prd-storage"
                className={selectClass}
                value={form.storageClassKey}
                onChange={(e) =>
                  setForm((f) =>
                    f ? { ...f, storageClassKey: e.target.value } : f,
                  )
                }
              >
                {storages.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Allergènes (codes, virgules)" htmlFor="prd-allergens">
              <AInput
                id="prd-allergens"
                value={form.allergenFlags}
                onChange={(e) =>
                  setForm((f) =>
                    f ? { ...f, allergenFlags: e.target.value } : f,
                  )
                }
                placeholder={
                  allergens.map((a) => a.code).join(", ") || "aucun"
                }
              />
            </Field>
            <div className="flex flex-col gap-3">
              <ASwitch
                label="Suivi lot"
                checked={form.trackLot}
                onCheckedChange={(v) =>
                  setForm((f) => (f ? { ...f, trackLot: v } : f))
                }
              />
              <ASwitch
                label="Périssable"
                checked={form.perishable}
                onCheckedChange={(v) =>
                  setForm((f) => (f ? { ...f, perishable: v } : f))
                }
              />
            </div>
            {formError ? (
              <p
                className="text-[length:var(--a-text-sm)] text-a-danger"
                role="alert"
              >
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
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[length:var(--a-text-sm)] text-a-fg"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
