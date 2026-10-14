"use client";

import { useCallback, useEffect, useState } from "react";
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
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  ATabs,
} from "@/components/a";
import { softSelect } from "@/lib/d294-ui";
import {
  approveSuggestion,
  convertSuggestion,
  createSuggestion,
  fetchSuggestions,
  generateSuggestions,
  rejectSuggestion,
  type Suggestion,
  type SuggestionReason,
} from "@/lib/procurement";
import { productLabel, toneFor, type ProcurementMeta } from "./shared";

const STATUS_FILTERS = [
  { id: "", label: "Tous" },
  { id: "OPEN", label: "Ouvert" },
  { id: "APPROVED", label: "Approuvé" },
  { id: "REJECTED", label: "Rejeté" },
  { id: "CONVERTED", label: "Converti" },
] as const;

const REASONS: SuggestionReason[] = ["MIN", "SAFETY", "FORECAST", "MANUAL"];

type ListState =
  | { kind: "loading" }
  | { kind: "ok"; items: Suggestion[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export function ProcurementSuggestionsPanel({ meta }: { meta: ProcurementMeta }) {
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("10");
  const [reason, setReason] = useState<SuggestionReason>("MANUAL");

  const [convertTarget, setConvertTarget] = useState<Suggestion | null>(null);
  const [convertSupplier, setConvertSupplier] = useState("");
  const [convertWarehouse, setConvertWarehouse] = useState("");
  const [convertQty, setConvertQty] = useState("");
  const [convertPrice, setConvertPrice] = useState("0");
  const [convertEta, setConvertEta] = useState("");

  const load = useCallback(async (statusFilter?: string) => {
    setState({ kind: "loading" });
    const res = await fetchSuggestions(statusFilter || undefined);
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
    setConvertSupplier((cur) => cur || meta.suppliers[0]?.id || "");
    setConvertWarehouse((cur) => cur || meta.warehouses[0]?.id || "");
  }, [meta.products, meta.suppliers, meta.warehouses]);

  async function reload() {
    await load(status);
  }

  async function onDecide(row: Suggestion, decision: "approve" | "reject") {
    setBusy(true);
    const res =
      decision === "approve"
        ? await approveSuggestion(row.id, row.version)
        : await rejectSuggestion(row.id, row.version);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await reload();
  }

  async function onGenerate() {
    setBusy(true);
    setNotice(null);
    const res = await generateSuggestions();
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    setNotice(
      `${res.data.scanned} seuil(s) analysé(s) · ${res.data.created} suggestion(s) créée(s).`,
    );
    await reload();
  }

  function openCreate() {
    setFormError(null);
    setQty("10");
    setReason("MANUAL");
    setCreateOpen(true);
  }

  async function onCreate() {
    setBusy(true);
    setFormError(null);
    const res = await createSuggestion({
      productId,
      qty: Number(qty),
      reason,
      siteId: meta.siteId ?? undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setCreateOpen(false);
    await reload();
  }

  function openConvert(row: Suggestion) {
    setConvertTarget(row);
    setConvertQty(row.qty);
    setConvertPrice("0");
    setConvertEta("");
    setFormError(null);
  }

  async function onConvert() {
    if (!convertTarget) return;
    setBusy(true);
    setFormError(null);
    const res = await convertSuggestion(convertTarget.id, {
      version: convertTarget.version,
      supplierId: convertSupplier,
      unitPrice: Number(convertPrice),
      qty: convertQty.trim() ? Number(convertQty) : undefined,
      warehouseId: convertWarehouse || undefined,
      siteId: meta.siteId ?? undefined,
      expectedDate: convertEta || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setConvertTarget(null);
    setNotice(`BC ${res.data.number} créé (brouillon).`);
    await reload();
  }

  return (
    <>
      <AFilterBar
        filters={
          <ATabs
            ariaLabel="Filtre statut suggestion"
            items={STATUS_FILTERS}
            value={status}
            onValueChange={(id) => {
              setStatus(id);
              void load(id);
            }}
          />
        }
        utilities={
          <div className="flex flex-wrap gap-2">
            <AButton
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void onGenerate()}
            >
              Générer depuis seuils
            </AButton>
            <AButton type="button" size="sm" onClick={openCreate}>
              Nouvelle suggestion
            </AButton>
            <AListUtilities onFilter={() => void load(status)} />
          </div>
        }
      />

      {notice ? (
        <p className="rounded-[var(--a-radius-md)] bg-a-success-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-success-fg">
          {notice}
        </p>
      ) : null}

      {state.kind === "loading" ? <ASkeleton className="h-48 w-full" /> : null}
      {state.kind === "forbidden" ? (
        <AForbiddenState message={state.message} />
      ) : null}
      {state.kind === "error" ? (
        <AErrorState
          message={state.message}
          retryable
          onRetry={() => void load(status)}
        />
      ) : null}
      {state.kind === "ok" && state.items.length === 0 ? (
        <AEmptyState
          title="Aucune suggestion"
          description="Définissez des seuils de stock puis générez les suggestions d’achat."
          actionLabel="Nouvelle suggestion"
          onAction={openCreate}
        />
      ) : null}

      {state.kind === "ok" && state.items.length > 0 ? (
        <ASoftTable className="min-w-[720px]">
          <ASoftThead>
            <ASoftTr>
              <ASoftTh>Suggestion</ASoftTh>
              <ASoftTh>Produit</ASoftTh>
              <ASoftTh numeric>Qté</ASoftTh>
              <ASoftTh>Motif</ASoftTh>
              <ASoftTh>Statut</ASoftTh>
              <ASoftTh>Actions</ASoftTh>
            </ASoftTr>
          </ASoftThead>
          <tbody>
            {state.items.map((row) => (
              <ASoftTr key={row.id}>
                <ASoftTd>
                  <span className="a-mono font-medium">{row.number}</span>
                  <span className="mt-0.5 block text-[length:var(--a-text-xs)] text-a-fg-subtle">
                    {row.createdAt.slice(0, 10)}
                  </span>
                </ASoftTd>
                <ASoftTd>
                  {productLabel(meta.products, row.productId)}
                </ASoftTd>
                <ASoftTd numeric>{Number(row.qty).toFixed(3)}</ASoftTd>
                <ASoftTd>
                  <ABadge tone="neutral">{row.reason}</ABadge>
                </ASoftTd>
                <ASoftTd>
                  <ABadge tone={toneFor(row.status)}>{row.status}</ABadge>
                </ASoftTd>
                <ASoftTd>
                  <div className="flex flex-wrap gap-2">
                    {row.status === "OPEN" || row.status === "APPROVED" ? (
                      <>
                        <AButton
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => openConvert(row)}
                        >
                          Convertir en BC
                        </AButton>
                        {row.status === "OPEN" ? (
                          <>
                            <AButton
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => void onDecide(row, "approve")}
                            >
                              Approuver
                            </AButton>
                            <AButton
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => void onDecide(row, "reject")}
                            >
                              Rejeter
                            </AButton>
                          </>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </ASoftTd>
              </ASoftTr>
            ))}
          </tbody>
        </ASoftTable>
      ) : null}

      <ADrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nouvelle suggestion d’achat"
      >
        <div className="space-y-5 p-4">
          {formError ? (
            <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
              {formError}
            </p>
          ) : null}
          <AFormSection title="Besoin">
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
            <AField label="Quantité" required>
              <AInput
                value={qty}
                inputMode="decimal"
                onChange={(e) => setQty(e.target.value)}
              />
            </AField>
            <AField label="Motif">
              <select
                className={softSelect}
                value={reason}
                onChange={(e) => setReason(e.target.value as SuggestionReason)}
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </AField>
          </AFormSection>
          <AButton
            type="button"
            className="w-full"
            disabled={busy || !productId}
            onClick={() => void onCreate()}
          >
            Créer la suggestion
          </AButton>
        </div>
      </ADrawer>

      <ADrawer
        open={convertTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConvertTarget(null);
        }}
        title={convertTarget ? `Convertir ${convertTarget.number}` : "Convertir"}
        description="Crée un BC brouillon à partir de la suggestion."
      >
        <div className="space-y-5 p-4">
          {formError ? (
            <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
              {formError}
            </p>
          ) : null}
          <AFormSection title="Fournisseur">
            <AField label="Fournisseur" required>
              <select
                className={softSelect}
                value={convertSupplier}
                onChange={(e) => setConvertSupplier(e.target.value)}
              >
                {meta.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </AField>
            <AField label="Entrepôt de réception">
              <select
                className={softSelect}
                value={convertWarehouse}
                onChange={(e) => setConvertWarehouse(e.target.value)}
              >
                <option value="">—</option>
                {meta.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </option>
                ))}
              </select>
            </AField>
            <AField label="Quantité">
              <AInput
                value={convertQty}
                inputMode="decimal"
                onChange={(e) => setConvertQty(e.target.value)}
              />
            </AField>
            <AField label="Prix unitaire" required>
              <AInput
                value={convertPrice}
                inputMode="decimal"
                onChange={(e) => setConvertPrice(e.target.value)}
              />
            </AField>
            <AField label="Livraison souhaitée">
              <AInput
                type="date"
                value={convertEta}
                onChange={(e) => setConvertEta(e.target.value)}
              />
            </AField>
          </AFormSection>
          <AButton
            type="button"
            className="w-full"
            disabled={busy || !convertSupplier}
            onClick={() => void onConvert()}
          >
            Créer le BC
          </AButton>
        </div>
      </ADrawer>
    </>
  );
}
