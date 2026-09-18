"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AFormSection,
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
import { ATabs } from "@/components/a/a-tabs";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import {
  fetchShipment,
  fetchShipments,
  type DeliveryOrderLine,
  type DeliveryShipment,
} from "@/lib/delivery";
import {
  createReturnsRma,
  DISPOSITION_LABELS,
  fetchReturnsRmas,
  RMA_STATUS_LABELS,
  type ReturnsDisposition,
  type ReturnsRma,
  type ReturnsRmaStatus,
} from "@/lib/returns";

const STATUS_FILTERS: { id: "" | ReturnsRmaStatus; label: string }[] = [
  { id: "", label: "Tout" },
  { id: "DRAFT", label: "Brouillon" },
  { id: "POSTED", label: "Posté" },
  { id: "CANCELLED", label: "Annulé" },
];

function rmaBadgeTone(
  status: ReturnsRmaStatus,
): "success" | "warning" | "neutral" {
  if (status === "POSTED") return "success";
  if (status === "CANCELLED") return "warning";
  return "neutral";
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: ReturnsRma[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type LineDraft = {
  orderLineId: string;
  label: string;
  deliveredQty: number;
  qty: string;
  disposition: ReturnsDisposition;
  selected: boolean;
};

function ReturnsPageInner() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ReturnsRmaStatus>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [shipments, setShipments] = useState<DeliveryShipment[]>([]);
  const [shipmentId, setShipmentId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);

  const load = useCallback(async (query: string, status: "" | ReturnsRmaStatus) => {
    setState({ kind: "loading" });
    const res = await fetchReturnsRmas({ q: query, status });
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
    void load(q, statusFilter);
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openCreate() {
    setFormError(null);
    setShipmentId("");
    setNotes("");
    setLines([]);
    const res = await fetchShipments({ status: "DELIVERED" });
    if (res.ok) setShipments(res.data.items);
    else setShipments([]);
    setDrawerOpen(true);
  }

  async function onSelectShipment(id: string) {
    setShipmentId(id);
    setLines([]);
    if (!id) return;
    const res = await fetchShipment(id);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    const orderLines: DeliveryOrderLine[] = res.data.orderLines ?? [];
    setLines(
      orderLines
        .filter((l) => Number(l.deliveredQty ?? 0) > 0)
        .map((l) => ({
          orderLineId: l.id,
          label:
            l.productSku && l.productName
              ? `${l.productSku} — ${l.productName}`
              : l.productName ?? l.productId,
          deliveredQty: Number(l.deliveredQty ?? 0),
          qty: String(l.deliveredQty ?? "0"),
          disposition: "RESTOCK" as ReturnsDisposition,
          selected: true,
        })),
    );
  }

  async function onCreate() {
    if (!shipmentId) {
      setFormError("Sélectionnez une livraison DELIVERED.");
      return;
    }
    const selected = lines.filter((l) => l.selected);
    if (selected.length === 0) {
      setFormError("Sélectionnez au moins une ligne.");
      return;
    }
    const payload = [];
    for (const line of selected) {
      const qty = Number(line.qty.replace(",", "."));
      if (!Number.isFinite(qty) || qty <= 0) {
        setFormError("Quantité invalide.");
        return;
      }
      if (qty > line.deliveredQty) {
        setFormError(`Qté > livré pour ${line.label}.`);
        return;
      }
      payload.push({
        orderLineId: line.orderLineId,
        qty,
        disposition: line.disposition,
      });
    }

    setBusy(true);
    setFormError(null);
    const res = await createReturnsRma({
      shipmentId,
      notes: notes.trim() || undefined,
      lines: payload,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q, statusFilter);
    router.push(`/sales/returns/${res.data.id}`);
  }

  const recordCount = state.kind === "ok" ? state.items.length : null;

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/" className="hover:text-a-fg">
            Ventes
          </Link>
        }
        title="Retours"
        description={erpListDescription(
          recordCount,
          "Livraison DELIVERED → RMA → Poster (restock / rebut) → avoir DRAFT",
        )}
        primary={
          <AButton type="button" size="sm" onClick={() => void openCreate()}>
            Nouveau retour
          </AButton>
        }
      />
      <APageBody>
        <AFilterBar
          search={
            <AInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher RMA…"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q, statusFilter);
              }}
            />
          }
          filters={
            <ATabs
              ariaLabel="Filtrer par statut"
              value={statusFilter || "all"}
              onValueChange={(id) => {
                const next = (id === "all" ? "" : id) as "" | ReturnsRmaStatus;
                setStatusFilter(next);
                void load(q, next);
              }}
              items={STATUS_FILTERS.map((chip) => ({
                id: chip.id || "all",
                label: chip.label,
              }))}
            />
          }
          utilities={
            <AListUtilities onFilter={() => void load(q, statusFilter)} />
          }
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
            onRetry={() => void load(q, statusFilter)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun retour"
            description="Créez un RMA depuis une livraison livrée (DELIVERED)."
            actionLabel="Nouveau retour"
            onAction={() => void openCreate()}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <ASoftTable className="min-w-[48rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>RMA</ASoftTh>
                <ASoftTh>Livraison</ASoftTh>
                <ASoftTh>Client</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
                <ASoftTh>Avoir</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((row) => (
                <ASoftTr key={row.id}>
                  <ASoftTd>
                    <Link
                      href={`/sales/returns/${row.id}`}
                      className="a-mono font-medium text-a-accent hover:underline"
                    >
                      {row.number}
                    </Link>
                  </ASoftTd>
                  <ASoftTd className="a-mono">{row.shipmentNumber ?? "—"}</ASoftTd>
                  <ASoftTd>
                    <span className="a-mono text-a-fg-muted">
                      {row.customerCode}
                    </span>{" "}
                    {row.customerName}
                  </ASoftTd>
                  <ASoftTd>
                    <ABadge tone={rmaBadgeTone(row.status)}>
                      {RMA_STATUS_LABELS[row.status]}
                    </ABadge>
                  </ASoftTd>
                  <ASoftTd className="a-mono">
                    {row.creditNoteNumber ?? "—"}
                  </ASoftTd>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        ) : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Nouveau retour"
        description="Lien livraison DELIVERED — plafond = qté livrée restante"
        footer={
          <div className="flex justify-end gap-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => setDrawerOpen(false)}
            >
              {LAYOUT_ACTIONS.cancel}
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onCreate()}
            >
              Créer
            </AButton>
          </div>
        }
      >
        <div className="space-y-4">
          <AFormSection title="Livraison">
            <select
              className="w-full rounded-[var(--a-radius-sm)] border border-a-border bg-a-surface-2 px-2 py-1.5 text-[length:var(--a-text-sm)]"
              value={shipmentId}
              onChange={(e) => void onSelectShipment(e.target.value)}
            >
              <option value="">— Choisir —</option>
              {shipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.number} · {s.customerName ?? s.customerCode ?? ""}
                </option>
              ))}
            </select>
          </AFormSection>

          {lines.length > 0 ? (
            <AFormSection title="Lignes" description="Restock ou rebut">
              {lines.map((line) => (
                <div
                  key={line.orderLineId}
                  className="space-y-2 rounded-[var(--a-radius-sm)] bg-a-surface-3/60 p-3"
                >
                  <label className="flex items-center gap-2 text-[length:var(--a-text-sm)]">
                    <input
                      type="checkbox"
                      checked={line.selected}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.orderLineId === line.orderLineId
                              ? { ...l, selected: e.target.checked }
                              : l,
                          ),
                        )
                      }
                    />
                    {line.label}
                    <span className="a-mono text-a-fg-muted">
                      (livré {line.deliveredQty})
                    </span>
                  </label>
                  {line.selected ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="a-field-label">Qté retour</label>
                        <AInput
                          value={line.qty}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.orderLineId === line.orderLineId
                                  ? { ...l, qty: e.target.value }
                                  : l,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="a-field-label">Disposition</label>
                        <select
                          className="w-full rounded-[var(--a-radius-sm)] border border-a-border bg-a-surface-2 px-2 py-1.5"
                          value={line.disposition}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.orderLineId === line.orderLineId
                                  ? {
                                      ...l,
                                      disposition: e.target
                                        .value as ReturnsDisposition,
                                    }
                                  : l,
                              ),
                            )
                          }
                        >
                          <option value="RESTOCK">
                            {DISPOSITION_LABELS.RESTOCK}
                          </option>
                          <option value="SCRAP">
                            {DISPOSITION_LABELS.SCRAP}
                          </option>
                        </select>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </AFormSection>
          ) : null}

          <AFormSection title="Notes">
            <AInput value={notes} onChange={(e) => setNotes(e.target.value)} />
          </AFormSection>

          {formError ? (
            <p className="text-[length:var(--a-text-sm)] text-[color:var(--a-danger)]">
              {formError}
            </p>
          ) : null}
        </div>
      </ADrawer>
    </>
  );
}

export default function ReturnsPage() {
  return (
    <Suspense
      fallback={
        <APageBody>
          <ASkeleton className="h-10 w-48" />
          <ASkeleton className="h-10 w-full" />
        </APageBody>
      }
    >
      <ReturnsPageInner />
    </Suspense>
  );
}
