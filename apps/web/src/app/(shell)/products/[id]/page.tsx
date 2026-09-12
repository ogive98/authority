"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ABadge,
  AButton,
  AContextPanel,
  ADetailGrid,
  AErrorState,
  AForbiddenState,
  AInput,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASwitch,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import {
  STATUS_LABELS,
  activateProduct,
  archiveProduct,
  fetchProduct,
  fetchRefs,
  updateProduct,
  type Product,
  type RefValue,
} from "@/lib/products";
import { softSelect } from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; product: Product }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FormState = {
  name: string;
  typeKey: string;
  uom: string;
  trackLot: boolean;
  perishable: boolean;
  shelfLifeDays: string;
  productionOffsetDays: string;
  storageClassKey: string;
  allergenFlags: string;
};

export default function ProductEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [types, setTypes] = useState<RefValue[]>([]);
  const [uoms, setUoms] = useState<RefValue[]>([]);
  const [storages, setStorages] = useState<RefValue[]>([]);
  const [allergens, setAllergens] = useState<RefValue[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setState({ kind: "loading" });
    const [res, t, u, s, a] = await Promise.all([
      fetchProduct(id),
      fetchRefs("product_type"),
      fetchRefs("uom"),
      fetchRefs("storage_class"),
      fetchRefs("allergen"),
    ]);
    if (t.ok) setTypes(t.items);
    if (u.ok) setUoms(u.items);
    if (s.ok) setStorages(s.items);
    if (a.ok) setAllergens(a.items);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    const p = res.data;
    setForm({
      name: p.name,
      typeKey: p.typeKey,
      uom: p.uom,
      trackLot: p.trackLot,
      perishable: p.perishable,
      shelfLifeDays:
        p.shelfLifeDays != null && p.shelfLifeDays > 0
          ? String(p.shelfLifeDays)
          : "",
      productionOffsetDays:
        p.productionOffsetDays != null && p.productionOffsetDays >= 0
          ? String(p.productionOffsetDays)
          : "0",
      storageClassKey: p.storageClassKey,
      allergenFlags: p.allergenFlags.join(", "),
    });
    setState({ kind: "ok", product: p });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave() {
    if (!form || state.kind !== "ok") return;
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
    const offsetRaw = form.productionOffsetDays.trim();
    let productionOffsetDays: number | null = 0;
    if (offsetRaw !== "") {
      const o = Number(offsetRaw);
      if (!Number.isFinite(o) || o < 0) {
        setFormError(
          "Jours avant emballage : entier ≥ 0 (0 = prod = emballage).",
        );
        return;
      }
      productionOffsetDays = Math.trunc(o);
    }
    setBusy(true);
    setFormError(null);
    const allergenList = form.allergenFlags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await updateProduct(state.product.id, {
      name: form.name.trim(),
      typeKey: form.typeKey,
      uom: form.uom,
      trackLot: form.trackLot || shelfLifeDays != null,
      perishable: form.perishable || shelfLifeDays != null,
      shelfLifeDays,
      productionOffsetDays,
      storageClassKey: form.storageClassKey,
      allergenFlags: allergenList,
      version: state.product.version,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setState({ kind: "ok", product: res.data });
    setForm((f) =>
      f
        ? {
            ...f,
            shelfLifeDays:
              res.data.shelfLifeDays != null
                ? String(res.data.shelfLifeDays)
                : "",
          }
        : f,
    );
  }

  async function onActivate() {
    if (state.kind !== "ok") return;
    setBusy(true);
    const res = await activateProduct(state.product.id);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setState({ kind: "ok", product: res.data });
  }

  async function onArchive() {
    if (state.kind !== "ok") return;
    if (!window.confirm("Archiver ce produit ?")) return;
    setBusy(true);
    const res = await archiveProduct(state.product.id);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    router.push("/products");
  }

  const overflowItems =
    state.kind === "ok"
      ? [
          ...(state.product.status === "DRAFT"
            ? [
                {
                  id: "activate",
                  label: "Activer",
                  onSelect: () => void onActivate(),
                  disabled: busy,
                },
              ]
            : []),
          {
            id: "archive",
            label: "Archiver",
            onSelect: () => void onArchive(),
            disabled: busy,
            danger: true,
          },
        ]
      : [];

  return (
    <>
      <AScreenHeader
        kicker="Produits"
        title={
          state.kind === "ok"
            ? `Modifier · ${state.product.sku}`
            : "Modifier le produit"
        }
        description="Catalogue · conservation (jours) pour le certificat de salubrité."
        breadcrumb={
          <Link href="/products" className="text-a-accent hover:underline">
            ← Catalogue
          </Link>
        }
        status={
          state.kind === "ok" ? (
            <ABadge
              tone={
                state.product.status === "ACTIVE"
                  ? "success"
                  : state.product.status === "DRAFT"
                    ? "neutral"
                    : "warning"
              }
            >
              {STATUS_LABELS[state.product.status]}
            </ABadge>
          ) : null
        }
        primary={
          state.kind === "ok" && form ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onSave()}
            >
              {busy ? "…" : LAYOUT_ACTIONS.save}
            </AButton>
          ) : null
        }
        more={
          overflowItems.length > 0 ? (
            <AOverflowMenu items={overflowItems} />
          ) : null
        }
      />
      <APageBody>
        {state.kind === "loading" ? <ASkeleton className="h-64 w-full" /> : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load()}
          />
        ) : null}

        {state.kind === "ok" && form ? (
          <ADetailGrid
            primary={
              <APageSection title="Identité produit">
                <div className="max-w-xl space-y-4">
            <Field label="Nom" htmlFor="prd-name">
              <AInput
                id="prd-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Type" htmlFor="prd-type">
              <select
                id="prd-type"
                className={softSelect}
                value={form.typeKey}
                onChange={(e) => setForm({ ...form, typeKey: e.target.value })}
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
                className={softSelect}
                value={form.uom}
                onChange={(e) => setForm({ ...form, uom: e.target.value })}
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
                  setForm({ ...form, storageClassKey: e.target.value })
                }
              >
                {storages.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
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
                  setForm({
                    ...form,
                    shelfLifeDays,
                    ...(hasDays
                      ? { trackLot: true, perishable: true }
                      : {}),
                  });
                }}
                placeholder="7, 30, 60… (vide = hors certificat)"
                inputMode="numeric"
              />
              <p className="text-[11px] text-a-fg-subtle">
                Sert au certificat de salubrité et au calcul automatique de la
                DLC (emballage + jours).
              </p>
            </Field>
            <Field
              label="Jours avant emballage (date production)"
              htmlFor="prd-offset"
            >
              <AInput
                id="prd-offset"
                value={form.productionOffsetDays}
                onChange={(e) =>
                  setForm({ ...form, productionOffsetDays: e.target.value })
                }
                placeholder="0 = frais · 30 = affiné (modèle Word)"
                inputMode="numeric"
              />
              <p className="text-[11px] text-a-fg-subtle">
                Date production = emballage − ces jours. Ex. emballage 09/09 et
                30 j → production 10/08.
              </p>
            </Field>
            <Field label="Allergènes (codes, virgules)" htmlFor="prd-allergens">
              <AInput
                id="prd-allergens"
                value={form.allergenFlags}
                onChange={(e) =>
                  setForm({ ...form, allergenFlags: e.target.value })
                }
                placeholder={allergens.map((a) => a.code).join(", ") || "aucun"}
              />
            </Field>
            <div className="space-y-1.5">
              <ASwitch
                label="Suivi par lot et DLC"
                checked={form.trackLot || form.perishable}
                onCheckedChange={(v) =>
                  setForm({
                    ...form,
                    trackLot: v,
                    perishable: v,
                    ...(v
                      ? {}
                      : { shelfLifeDays: "" }),
                  })
                }
              />
              <p className="text-[11px] text-a-fg-subtle">
                Obligatoire pour le fromage / FEFO : chaque mouvement exige un
                n° de lot. Activé automatiquement si une conservation est
                saisie.
              </p>
            </div>

            {formError ? (
              <p className="text-[13px] text-a-danger" role="alert">
                {formError}
              </p>
            ) : null}
                </div>
              </APageSection>
            }
            context={
              <AContextPanel title="Résumé">
                <dl className="space-y-3 text-[13px]">
                  <div>
                    <dt className="text-a-fg-muted">SKU</dt>
                    <dd className="a-mono font-medium text-a-fg">
                      {state.product.sku}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Statut</dt>
                    <dd className="font-medium text-a-fg">
                      {STATUS_LABELS[state.product.status]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Unité</dt>
                    <dd className="text-a-fg">{form.uom}</dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Suivi lot</dt>
                    <dd className="text-a-fg">
                      {form.trackLot || form.perishable ? "Oui" : "Non"}
                    </dd>
                  </div>
                </dl>
              </AContextPanel>
            }
          />
        ) : null}
      </APageBody>
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
