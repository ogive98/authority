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
  AListUtilities,
  APageBody,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  erpListDescription,
} from "@/components/a";
import {
  cancelWorksheet,
  controlWorksheet,
  createWorksheet,
  fetchActiveProducts,
  fetchWorksheets,
  prepareWorksheet,
  weighWorksheet,
  type ProductOption,
  type Worksheet,
} from "@/lib/production";
import { cn } from "@/lib/utils";
import { softSelect } from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: Worksheet[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function statusTone(
  status: string,
): "neutral" | "accent" | "success" | "warning" | "danger" {
  switch (status) {
    case "CONTROLLED":
      return "success";
    case "PREPARED":
    case "WEIGHED":
      return "accent";
    case "REJECTED":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export default function ProductionWorksheetsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
  const [selected, setSelected] = useState<Worksheet | null>(null);
  const [productId, setProductId] = useState("");
  const [requestedQty, setRequestedQty] = useState("10");
  const [lineQty, setLineQty] = useState<Record<string, string>>({});
  const [controlNote, setControlNote] = useState("");

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const res = await fetchWorksheets(query);
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
    void fetchActiveProducts().then((pr) => {
      if (pr.ok) {
        setProducts(pr.data.items);
        if (pr.data.items[0]) setProductId(pr.data.items[0].id);
      }
    });
  }, [load]);

  function openFlow(row: Worksheet) {
    setSelected(row);
    const next: Record<string, string> = {};
    for (const line of row.lines) {
      if (row.status === "DRAFT") {
        next[line.id] = line.preparedQty ?? line.requestedQty;
      } else if (row.status === "PREPARED") {
        next[line.id] =
          line.weighedQty ?? line.preparedQty ?? line.requestedQty;
      }
    }
    setLineQty(next);
    setControlNote("");
    setFormError(null);
    setFlowOpen(true);
  }

  async function onCreate() {
    setBusy(true);
    setFormError(null);
    const res = await createWorksheet({
      lines: [{ productId, requestedQty: Number(requestedQty), unit: "KG" }],
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setCreateOpen(false);
    await load(q);
  }

  async function onPrepare() {
    if (!selected) return;
    setBusy(true);
    setFormError(null);
    const res = await prepareWorksheet(
      selected.id,
      selected.lines.map((l) => ({
        id: l.id,
        qty: Number(lineQty[l.id] ?? l.requestedQty),
      })),
    );
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setFlowOpen(false);
    await load(q);
  }

  async function onWeigh() {
    if (!selected) return;
    setBusy(true);
    setFormError(null);
    const res = await weighWorksheet(
      selected.id,
      selected.lines.map((l) => ({
        id: l.id,
        qty: Number(lineQty[l.id] ?? l.preparedQty ?? l.requestedQty),
      })),
    );
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setFlowOpen(false);
    await load(q);
  }

  async function onControl(result: "PASS" | "FAIL") {
    if (!selected) return;
    if (result === "FAIL" && !controlNote.trim()) {
      setFormError("Motif obligatoire pour un rejet contrôle.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await controlWorksheet(selected.id, {
      result,
      note: controlNote.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setFlowOpen(false);
    await load(q);
  }

  async function onCancel(row: Worksheet) {
    setBusy(true);
    const res = await cancelWorksheet(row.id);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  return (
    <>
      <AScreenHeader
        kicker="Production"
        title="Fiches digitales"
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "Prep → Pesage manuel → Contrôle — sans OF auto · sans balance · sans facturation (D292)",
        )}
        primary={
          <AButton type="button" size="sm" onClick={() => setCreateOpen(true)}>
            Nouvelle fiche
          </AButton>
        }
        more={
          <Link
            href="/production"
            className="text-[length:var(--a-text-sm)] text-a-accent underline-offset-2 hover:underline"
          >
            Ordres de fabrication
          </Link>
        }
      />

      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="ws-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° fiche…"
              aria-label="Recherche fiches"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q);
              }}
            />
          }
          utilities={<AListUtilities onFilter={() => void load(q)} />}
        />

        {state.kind === "loading" ? (
          <ASkeleton className="h-48 w-full" />
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
            title="Aucune fiche"
            description="Créez une fiche Prep→Pesage→Contrôle pour une ligne produit."
            actionLabel="Nouvelle fiche"
            onAction={() => setCreateOpen(true)}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <ASoftTable className="min-w-[640px]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>N°</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
                <ASoftTh>Lignes</ASoftTh>
                <ASoftTh>Créée</ASoftTh>
                <ASoftTh>Actions</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((row) => (
                <ASoftTr key={row.id}>
                  <ASoftTd>
                    <span className="a-mono font-medium">{row.number}</span>
                  </ASoftTd>
                  <ASoftTd>
                    <ABadge tone={statusTone(row.status)}>
                      {row.status}
                    </ABadge>
                  </ASoftTd>
                  <ASoftTd className="a-mono a-tabular">
                    {row.lines.length}
                  </ASoftTd>
                  <ASoftTd className="text-a-fg-muted">
                    {new Date(row.createdAt).toLocaleString("fr-TN")}
                  </ASoftTd>
                  <ASoftTd>
                    <div className="flex flex-wrap gap-2">
                      {["DRAFT", "PREPARED", "WEIGHED"].includes(
                        row.status,
                      ) ? (
                        <AButton
                          type="button"
                          size="sm"
                          onClick={() => openFlow(row)}
                        >
                          {row.status === "DRAFT"
                            ? "Préparer"
                            : row.status === "PREPARED"
                              ? "Peser"
                              : "Contrôler"}
                        </AButton>
                      ) : null}
                      {["DRAFT", "PREPARED", "WEIGHED", "REJECTED"].includes(
                        row.status,
                      ) ? (
                        <AButton
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void onCancel(row)}
                        >
                          Annuler
                        </AButton>
                      ) : null}
                    </div>
                  </ASoftTd>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        ) : null}
      </APageBody>

      <ADrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nouvelle fiche digitale"
        description="Une ligne produit · unit KG · transitions humaines."
        footer={
          <AButton
            type="button"
            size="sm"
            disabled={busy || !productId}
            onClick={() => void onCreate()}
          >
            Créer
          </AButton>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="text-[length:var(--a-text-xs)] text-a-fg-muted">
            Produit
            <select
              className={cn(softSelect, "mt-1 w-full")}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[length:var(--a-text-xs)] text-a-fg-muted">
            Qté demandée (KG)
            <AInput
              className="mt-1"
              value={requestedQty}
              onChange={(e) => setRequestedQty(e.target.value)}
            />
          </label>
          {formError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-danger">
              {formError}
            </p>
          ) : null}
        </div>
      </ADrawer>

      <ADrawer
        open={flowOpen}
        onOpenChange={setFlowOpen}
        title={
          selected
            ? `${selected.number} · ${selected.status}`
            : "Fiche digitale"
        }
        description="Pesage manuel uniquement — pas de balance Devices (D292)."
        footer={
          selected?.status === "DRAFT" ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onPrepare()}
            >
              Confirmer préparation
            </AButton>
          ) : selected?.status === "PREPARED" ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onWeigh()}
            >
              Confirmer pesage
            </AButton>
          ) : selected?.status === "WEIGHED" ? (
            <div className="flex gap-2">
              <AButton
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void onControl("PASS")}
              >
                Contrôle OK
              </AButton>
              <AButton
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void onControl("FAIL")}
              >
                Rejeter
              </AButton>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="flex flex-col gap-3">
            {selected.lines.map((line) => (
              <div
                key={line.id}
                className="a-underlay rounded-[var(--a-radius-sm)] p-3"
              >
                <p className="text-[length:var(--a-text-sm)]">
                  {line.productSku ?? line.productId.slice(0, 8)} — demandé{" "}
                  <span className="a-mono a-tabular">
                    {line.requestedQty} {line.unit}
                  </span>
                </p>
                {selected.status === "DRAFT" ||
                selected.status === "PREPARED" ? (
                  <label className="mt-2 block text-[length:var(--a-text-xs)] text-a-fg-muted">
                    {selected.status === "DRAFT"
                      ? "Qté préparée"
                      : "Qté pesée (manuel)"}
                    <AInput
                      className="mt-1"
                      value={lineQty[line.id] ?? ""}
                      onChange={(e) =>
                        setLineQty((m) => ({
                          ...m,
                          [line.id]: e.target.value,
                        }))
                      }
                    />
                  </label>
                ) : (
                  <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Préparé {line.preparedQty ?? "—"} · Pesé{" "}
                    {line.weighedQty ?? "—"}
                  </p>
                )}
              </div>
            ))}

            {selected.status === "WEIGHED" ? (
              <label className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Note contrôle (obligatoire si rejet)
                <AInput
                  className="mt-1"
                  value={controlNote}
                  onChange={(e) => setControlNote(e.target.value)}
                />
              </label>
            ) : null}

            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}
