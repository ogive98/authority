"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
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
  APageBody,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftThead,
  ASoftTr,
  ASwitch,
  erpListDescription,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import {
  STATUS_LABELS,
  activateProduct,
  createProduct,
  fetchProducts,
  fetchRefs,
  type Product,
  type RefValue,
} from "@/lib/products";
import { softSelect } from "@/lib/d294-ui";

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
  shelfLifeDays: string;
  storageClassKey: string;
  allergenFlags: string;
};

export default function ProductsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const emptyForm = useCallback((): FormState => {
    return {
      sku: "",
      name: "",
      typeKey: types[0]?.code ?? "",
      uom: uoms[0]?.code ?? "",
      trackLot: false,
      perishable: false,
      shelfLifeDays: "",
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
    setForm(emptyForm());
    setFormError(null);
    setDrawerOpen(true);
  }

  async function submitForm() {
    if (!form) return;
    const shelfRaw = form.shelfLifeDays.trim();
    let shelfLifeDays: number | null = null;
    if (shelfRaw) {
      const n = Number(shelfRaw);
      if (!Number.isFinite(n) || n < 1) {
        setFormError("Conservation : entier ≥ 1 (ex. 7, 30, 60) ou vide.");
        return;
      }
      shelfLifeDays = Math.trunc(n);
    }
    setBusy(true);
    setFormError(null);
    const allergenList = form.allergenFlags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await createProduct({
      sku: form.sku.trim(),
      name: form.name.trim(),
      typeKey: form.typeKey,
      uom: form.uom,
      trackLot: form.trackLot || shelfLifeDays != null,
      perishable: form.perishable || shelfLifeDays != null,
      shelfLifeDays,
      storageClassKey: form.storageClassKey,
      allergenFlags: allergenList,
    });
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

  return (
    <>
      <AScreenHeader
        title="Produits"
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "catalogue · conservation · salubrité",
        )}
        primary={
          <AButton type="button" size="sm" onClick={openCreate}>
            {LAYOUT_ACTIONS.newProduct}
          </AButton>
        }
      />
      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="prd-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher SKU, nom…"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q);
              }}
            />
          }
          utilities={<AListUtilities onFilter={() => void load(q)} />}
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
            onRetry={() => void load(q)}
          />
        ) : null}

        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun produit"
            description="Créez le premier article du catalogue."
            actionLabel={LAYOUT_ACTIONS.newProduct}
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <ASoftTable className="min-w-[40rem]">
            <ASoftThead>
              <tr>
                <th className="a-table-cell font-medium">SKU</th>
                <th className="a-table-cell font-medium">Nom</th>
                <th className="a-table-cell font-medium">Type</th>
                <th className="a-table-cell font-medium">Conserv.</th>
                <th className="a-table-cell font-medium">Statut</th>
                <th className="a-table-cell font-medium">Actions</th>
              </tr>
            </ASoftThead>
            <tbody>
              {state.items.map((row) => (
                <ASoftTr key={row.id}>
                    <td className="a-mono a-table-cell">
                      <Link
                        href={`/products/${row.id}`}
                        className="text-a-accent hover:underline"
                      >
                        {row.sku}
                      </Link>
                    </td>
                    <td className="a-table-cell">{row.name}</td>
                    <td className="a-table-cell text-a-fg-muted">
                      {typeLabel(row.typeKey)}
                    </td>
                    <td className="a-mono a-table-cell text-a-fg-muted">
                      {row.shelfLifeDays != null
                        ? `${row.shelfLifeDays} j`
                        : "—"}
                    </td>
                    <td className="a-table-cell">
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
                    <td className="a-table-cell">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/products/${row.id}`}>
                          <AButton type="button" size="sm" variant="secondary">
                            Modifier
                          </AButton>
                        </Link>
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
                      </div>
                    </td>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        ) : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nouveau produit"
        description="Référentiels société · conservation optionnelle"
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
          <div className="space-y-5 p-4">
            <AFormSection title="Identité">
              <Field label="SKU" htmlFor="prd-sku">
                <AInput
                  id="prd-sku"
                  value={form.sku}
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
                  className={softSelect}
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
            </AFormSection>

            <AFormSection title="Unité & stockage">
              <Field label="Unité" htmlFor="prd-uom">
                <select
                  id="prd-uom"
                  className={softSelect}
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
                  className={softSelect}
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
            </AFormSection>

            <AFormSection
              title="Conservation & allergènes"
              description="Sert au certificat de salubrité et au calcul de la DLC."
            >
              <Field
                label="Conservation (jours après emballage)"
                htmlFor="prd-shelf"
              >
                <AInput
                  id="prd-shelf"
                  value={form.shelfLifeDays}
                  onChange={(e) => {
                    const shelfLifeDays = e.target.value;
                    const hasDays = shelfLifeDays.trim().length > 0;
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            shelfLifeDays,
                            ...(hasDays
                              ? { trackLot: true, perishable: true }
                              : {}),
                          }
                        : f,
                    );
                  }}
                  placeholder="7, 30, 60… (vide = hors certificat)"
                  inputMode="numeric"
                />
              </Field>
              <Field
                label="Allergènes (codes, virgules)"
                htmlFor="prd-allergens"
              >
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
              <div className="space-y-1.5">
                <ASwitch
                  label="Suivi par lot et DLC"
                  checked={form.trackLot || form.perishable}
                  onCheckedChange={(v) =>
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            trackLot: v,
                            perishable: v,
                            ...(v ? {} : { shelfLifeDays: "" }),
                          }
                        : f,
                    )
                  }
                />
                <p className="text-[11px] text-a-fg-subtle">
                  Obligatoire pour fromage / FEFO. Activé si conservation
                  renseignée.
                </p>
              </div>
            </AFormSection>

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
    <AField label={label} htmlFor={htmlFor}>
      {children}
    </AField>
  );
}
