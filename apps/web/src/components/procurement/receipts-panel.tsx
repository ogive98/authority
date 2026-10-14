"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  AConfirmDialog,
  ADrawer,
  AEmptyState,
  AErrorState,
  AField,
  AFilterBar,
  AForbiddenState,
  AFormSection,
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
  fetchPos,
  fetchReceipt,
  fetchReceipts,
  postReceipt,
  updateReceipt,
  type Receipt,
} from "@/lib/procurement";
import { productLabel, toneFor, type ProcurementMeta } from "./shared";

const STATUS_FILTERS = [
  { id: "", label: "Tous" },
  { id: "DRAFT", label: "Brouillon" },
  { id: "POSTED", label: "Posté" },
] as const;

const QC_OPTIONS = ["", "PENDING", "PASS", "FAIL"] as const;

type ListState =
  | { kind: "loading" }
  | { kind: "ok"; items: Receipt[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export function ProcurementReceiptsPanel({ meta }: { meta: ProcurementMeta }) {
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [status, setStatus] = useState("");
  const [poNumbers, setPoNumbers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Receipt | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [postTarget, setPostTarget] = useState<Receipt | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const [receipts, pos] = await Promise.all([fetchReceipts(), fetchPos()]);
    if (!receipts.ok) {
      setState({
        kind: receipts.status === 403 ? "forbidden" : "error",
        message: receipts.message,
      });
      return;
    }
    if (pos.ok) {
      setPoNumbers(
        Object.fromEntries(pos.data.items.map((p) => [p.id, p.number])),
      );
    }
    setState({ kind: "ok", items: receipts.data.items });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(row: Receipt) {
    const res = await fetchReceipt(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    setDetail(res.data);
    setDetailOpen(true);
  }

  async function onQc(row: Receipt, qcStatus: string) {
    setBusy(true);
    const res = await updateReceipt(row.id, {
      version: row.version,
      qcStatus: qcStatus || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load();
  }

  async function onPost() {
    if (!postTarget) return;
    setBusy(true);
    const res = await postReceipt(postTarget.id, postTarget.version);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    setPostTarget(null);
    setDetailOpen(false);
    await load();
  }

  const items =
    state.kind === "ok"
      ? status
        ? state.items.filter((r) => r.status === status)
        : state.items
      : [];

  return (
    <>
      <AFilterBar
        filters={
          <ATabs
            ariaLabel="Filtre statut réception"
            items={STATUS_FILTERS}
            value={status}
            onValueChange={setStatus}
          />
        }
        utilities={<AListUtilities onFilter={() => void load()} />}
      />

      {state.kind === "loading" ? <ASkeleton className="h-48 w-full" /> : null}
      {state.kind === "forbidden" ? (
        <AForbiddenState message={state.message} />
      ) : null}
      {state.kind === "error" ? (
        <AErrorState message={state.message} retryable onRetry={() => void load()} />
      ) : null}
      {state.kind === "ok" && items.length === 0 ? (
        <AEmptyState
          title="Aucune réception"
          description="Réceptionnez un bon de commande envoyé ou confirmé."
        />
      ) : null}

      {state.kind === "ok" && items.length > 0 ? (
        <ASoftTable className="min-w-[760px]">
          <ASoftThead>
            <ASoftTr>
              <ASoftTh>Réception</ASoftTh>
              <ASoftTh>BC</ASoftTh>
              <ASoftTh>Nature</ASoftTh>
              <ASoftTh>QC</ASoftTh>
              <ASoftTh>Statut</ASoftTh>
              <ASoftTh>Dette AP</ASoftTh>
              <ASoftTh>Actions</ASoftTh>
            </ASoftTr>
          </ASoftThead>
          <tbody>
            {items.map((row) => (
              <ASoftTr key={row.id}>
                <ASoftTd>
                  <button
                    type="button"
                    className="a-mono font-medium text-a-accent underline-offset-2 hover:underline"
                    onClick={() => void openDetail(row)}
                  >
                    {row.number}
                  </button>
                  <span className="mt-0.5 block text-[length:var(--a-text-xs)] text-a-fg-subtle">
                    {row.createdAt.slice(0, 10)}
                  </span>
                </ASoftTd>
                <ASoftTd className="a-mono">
                  {poNumbers[row.poId] ?? row.poId.slice(0, 8)}
                </ASoftTd>
                <ASoftTd>
                  <ABadge tone={toneFor(row.kind)}>{row.kind}</ABadge>
                </ASoftTd>
                <ASoftTd>
                  {row.status === "DRAFT" ? (
                    <select
                      className={softSelect}
                      aria-label={`Contrôle qualité ${row.number}`}
                      value={row.qcStatus ?? ""}
                      disabled={busy}
                      onChange={(e) => void onQc(row, e.target.value)}
                    >
                      {QC_OPTIONS.map((qc) => (
                        <option key={qc || "none"} value={qc}>
                          {qc || "—"}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="a-mono text-a-fg-muted">
                      {row.qcStatus ?? "—"}
                    </span>
                  )}
                </ASoftTd>
                <ASoftTd>
                  <ABadge tone={toneFor(row.status)}>{row.status}</ABadge>
                </ASoftTd>
                <ASoftTd className="a-mono">
                  {row.apBillId ? row.apBillId.slice(0, 8) : "—"}
                </ASoftTd>
                <ASoftTd>
                  {row.status === "DRAFT" ? (
                    <AButton
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => setPostTarget(row)}
                    >
                      Poster
                    </AButton>
                  ) : null}
                </ASoftTd>
              </ASoftTr>
            ))}
          </tbody>
        </ASoftTable>
      ) : null}

      <ADrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={detail ? `Réception ${detail.number}` : "Réception"}
        description={
          detail
            ? `${detail.kind} · ${detail.status} · BC ${poNumbers[detail.poId] ?? "—"}`
            : undefined
        }
      >
        {detail ? (
          <div className="space-y-5 p-4">
            <AFormSection title="Lignes">
              <ASoftTable>
                <ASoftThead>
                  <ASoftTr>
                    <ASoftTh>Produit</ASoftTh>
                    <ASoftTh numeric>Qté</ASoftTh>
                    <ASoftTh>Lot</ASoftTh>
                    <ASoftTh>DLC</ASoftTh>
                    <ASoftTh numeric>PU</ASoftTh>
                  </ASoftTr>
                </ASoftThead>
                <tbody>
                  {(detail.lines ?? []).map((l) => (
                    <ASoftTr key={l.id}>
                      <ASoftTd>
                        {productLabel(meta.products, l.productId)}
                      </ASoftTd>
                      <ASoftTd numeric>{Number(l.qty).toFixed(3)}</ASoftTd>
                      <ASoftTd className="a-mono">{l.lotCode ?? "—"}</ASoftTd>
                      <ASoftTd className="a-mono">
                        {l.dlc?.slice(0, 10) ?? "—"}
                      </ASoftTd>
                      <ASoftTd numeric>{Number(l.unitPrice).toFixed(3)}</ASoftTd>
                    </ASoftTr>
                  ))}
                </tbody>
              </ASoftTable>
            </AFormSection>
            <AFormSection title="Suivi">
              <AField label="Contrôle qualité">
                <p className="text-[length:var(--a-text-sm)]">
                  {detail.qcStatus ?? "—"}
                </p>
              </AField>
              <AField label="Facture fournisseur (AP)">
                <p className="a-mono text-[length:var(--a-text-sm)]">
                  {detail.apBillId ?? "—"}
                </p>
              </AField>
              <AField label="Posté le">
                <p className="a-mono text-[length:var(--a-text-sm)]">
                  {detail.postedAt?.slice(0, 10) ?? "—"}
                </p>
              </AField>
            </AFormSection>
            {detail.status === "DRAFT" ? (
              <AButton
                type="button"
                className="w-full"
                disabled={busy}
                onClick={() => setPostTarget(detail)}
              >
                Poster la réception
              </AButton>
            ) : null}
          </div>
        ) : null}
      </ADrawer>

      <AConfirmDialog
        open={postTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPostTarget(null);
        }}
        risk="stock"
        consequence="Impact stock + dette fournisseur : le mouvement est irréversible sans correction d’inventaire."
        confirmPhrase="POSTER"
        confirmLabel="Poster la réception"
        onConfirm={() => void onPost()}
      />
    </>
  );
}
