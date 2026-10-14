"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AButton,
  AConfirmDialog,
  AEmptyState,
  AErrorState,
  AField,
  AFilterBar,
  AForbiddenState,
  AFormSection,
  AInput,
  AListUtilities,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
} from "@/components/a";
import { softSelect } from "@/lib/d294-ui";
import {
  fetchPolicies,
  removePolicy,
  upsertPolicy,
  type StockPolicy,
} from "@/lib/procurement";
import { productLabel, siteLabel, type ProcurementMeta } from "./shared";

type ListState =
  | { kind: "loading" }
  | { kind: "ok"; items: StockPolicy[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export function ProcurementPoliciesPanel({ meta }: { meta: ProcurementMeta }) {
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [minQty, setMinQty] = useState("0");
  const [safetyQty, setSafetyQty] = useState("0");
  const [removeTarget, setRemoveTarget] = useState<StockPolicy | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await fetchPolicies();
    if (!res.ok) {
      setState({
        kind: res.status === 403 ? "forbidden" : "error",
        message: res.message,
      });
      return;
    }
    setState({ kind: "ok", items: res.data.items });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setProductId((cur) => cur || meta.products[0]?.id || "");
  }, [meta.products]);

  useEffect(() => {
    setSiteId((cur) => cur || meta.siteId || meta.sites[0]?.id || "");
  }, [meta.siteId, meta.sites]);

  async function onUpsert() {
    if (!siteId) {
      setFormError("Aucun site actif — sélectionnez un site.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await upsertPolicy({
      productId,
      siteId,
      minQty: Number(minQty),
      safetyQty: Number(safetyQty),
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    await load();
  }

  async function onRemove() {
    if (!removeTarget) return;
    setBusy(true);
    const res = await removePolicy(removeTarget.id);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    setRemoveTarget(null);
    await load();
  }

  return (
    <>
      <AFilterBar utilities={<AListUtilities onFilter={() => void load()} />} />

      {state.kind === "loading" ? <ASkeleton className="h-48 w-full" /> : null}
      {state.kind === "forbidden" ? (
        <AForbiddenState message={state.message} />
      ) : null}
      {state.kind === "error" ? (
        <AErrorState message={state.message} retryable onRetry={() => void load()} />
      ) : null}
      {state.kind === "ok" && state.items.length === 0 ? (
        <AEmptyState
          title="Aucun seuil de stock"
          description="Définissez un minimum par produit / site pour générer les suggestions d’achat."
        />
      ) : null}

      {state.kind === "ok" && state.items.length > 0 ? (
        <ASoftTable className="min-w-[640px]">
          <ASoftThead>
            <ASoftTr>
              <ASoftTh>Produit</ASoftTh>
              <ASoftTh numeric>Minimum</ASoftTh>
              <ASoftTh numeric>Sécurité</ASoftTh>
              <ASoftTh>Site</ASoftTh>
              <ASoftTh>Actions</ASoftTh>
            </ASoftTr>
          </ASoftThead>
          <tbody>
            {state.items.map((row) => (
              <ASoftTr key={row.id}>
                <ASoftTd>
                  {productLabel(meta.products, row.productId)}
                </ASoftTd>
                <ASoftTd numeric>{Number(row.minQty).toFixed(3)}</ASoftTd>
                <ASoftTd numeric>{Number(row.safetyQty).toFixed(3)}</ASoftTd>
                <ASoftTd className="a-mono">
                  {siteLabel(meta.sites, row.siteId)}
                </ASoftTd>
                <ASoftTd>
                  <div className="flex flex-wrap gap-2">
                    <AButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setProductId(row.productId);
                        setMinQty(row.minQty);
                        setSafetyQty(row.safetyQty);
                      }}
                    >
                      Modifier
                    </AButton>
                    <AButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setRemoveTarget(row)}
                    >
                      Supprimer
                    </AButton>
                  </div>
                </ASoftTd>
              </ASoftTr>
            ))}
          </tbody>
        </ASoftTable>
      ) : null}

      <AFormSection
        title="Seuil de stock"
        description="Le scan compare stock + commandes en cours au minimum."
      >
        {formError ? (
          <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
            {formError}
          </p>
        ) : null}
        <AField label="Produit" required>
          <select
            className={softSelect}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            {meta.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} · {p.name}
              </option>
            ))}
          </select>
        </AField>
        <AField label="Quantité minimum" required>
          <AInput
            value={minQty}
            inputMode="decimal"
            onChange={(e) => setMinQty(e.target.value)}
          />
        </AField>
        <AField label="Quantité de sécurité">
          <AInput
            value={safetyQty}
            inputMode="decimal"
            onChange={(e) => setSafetyQty(e.target.value)}
          />
        </AField>
        <AField label="Site" required>
          {meta.sites.length === 0 ? (
            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Aucun site disponible pour cette société.
            </p>
          ) : (
            <select
              className={softSelect}
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              {meta.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code}
                </option>
              ))}
            </select>
          )}
        </AField>
        <AButton
          type="button"
          disabled={busy || !productId || !siteId || meta.sites.length === 0}
          onClick={() => void onUpsert()}
        >
          Enregistrer le seuil
        </AButton>
      </AFormSection>

      <AConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        risk="destroy"
        consequence="Le seuil sera retiré — le scan ne générera plus de suggestion pour ce produit."
        confirmLabel="Supprimer le seuil"
        onConfirm={() => void onRemove()}
      />
    </>
  );
}
