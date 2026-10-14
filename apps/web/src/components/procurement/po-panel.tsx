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
  AInput,
  AListUtilities,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  ATabs,
  erpListDescription,
} from "@/components/a";
import { softSelect } from "@/lib/d294-ui";
import {
  createPo,
  createReceipt,
  fetchPo,
  fetchPos,
  sendPo,
  transitionPo,
  type MessageChannel,
  type Po,
  type ReceiptKind,
} from "@/lib/procurement";
import {
  productLabel,
  toneFor,
  warehouseLabel,
  type ProcurementMeta,
} from "./shared";

const STATUS_FILTERS = [
  { id: "", label: "Tous" },
  { id: "DRAFT", label: "Brouillon" },
  { id: "SUBMITTED", label: "Soumis" },
  { id: "APPROVED", label: "Approuvé" },
  { id: "SENT", label: "Envoyé" },
  { id: "CONFIRMED", label: "Confirmé" },
  { id: "PARTIAL", label: "Partiel" },
  { id: "RECEIVED", label: "Reçu" },
  { id: "CANCELLED", label: "Annulé" },
] as const;

const RECEIVABLE = new Set(["SENT", "CONFIRMED", "PARTIAL"]);
const CANCELLABLE = new Set(["DRAFT", "SUBMITTED", "APPROVED", "SENT", "CONFIRMED"]);

type ListState =
  | { kind: "loading" }
  | { kind: "ok"; items: Po[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type DraftLine = { productId: string; qty: string; unitPrice: string };

type ReceiptDraft = { poLineId: string; qty: string; lotCode: string };

export function ProcurementPoPanel({ meta }: { meta: ProcurementMeta }) {
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [detail, setDetail] = useState<Po | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);

  const [receiptPo, setReceiptPo] = useState<Po | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptKind, setReceiptKind] = useState<ReceiptKind>("RECEIPT");
  const [receiptWarehouse, setReceiptWarehouse] = useState("");
  const [receiptLines, setReceiptLines] = useState<ReceiptDraft[]>([]);

  const [sendTarget, setSendTarget] = useState<Po | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendChannel, setSendChannel] = useState<MessageChannel>("WHATSAPP");
  const [sendAddress, setSendAddress] = useState("");

  const [cancelTarget, setCancelTarget] = useState<Po | null>(null);

  const load = useCallback(async (query?: string, statusFilter?: string) => {
    setState({ kind: "loading" });
    const res = await fetchPos({ q: query, status: statusFilter });
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
    setSupplierId((cur) => cur || meta.suppliers[0]?.id || "");
    setWarehouseId((cur) => cur || meta.warehouses[0]?.id || "");
  }, [meta.suppliers, meta.warehouses]);

  async function reload() {
    await load(q, status);
  }

  async function openDetail(row: Po) {
    const res = await fetchPo(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    setDetail(res.data);
    setDetailOpen(true);
  }

  function openCreate() {
    setFormError(null);
    setNotes("");
    setExpectedDate("");
    setLines(
      meta.products[0]
        ? [{ productId: meta.products[0].id, qty: "10", unitPrice: "0" }]
        : [],
    );
    setCreateOpen(true);
  }

  async function onCreate() {
    setBusy(true);
    setFormError(null);
    const res = await createPo({
      supplierId,
      warehouseId: warehouseId || undefined,
      expectedDate: expectedDate || undefined,
      notes: notes.trim() || undefined,
      lines: lines.map((l) => ({
        productId: l.productId,
        qtyOrdered: Number(l.qty),
        unitPrice: Number(l.unitPrice),
      })),
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setCreateOpen(false);
    await reload();
  }

  async function onTransition(row: Po, action: "submit" | "approve" | "confirm") {
    setBusy(true);
    const res = await transitionPo(row.id, action, row.version);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    setDetailOpen(false);
    await reload();
  }

  async function onSend() {
    if (!sendTarget) return;
    setBusy(true);
    setFormError(null);
    const res = await sendPo(sendTarget.id, {
      version: sendTarget.version,
      channel: sendChannel,
      toAddress: sendAddress.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setSendOpen(false);
    setSendTarget(null);
    await reload();
  }

  async function onCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    const res = await transitionPo(cancelTarget.id, "cancel", cancelTarget.version);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    setCancelTarget(null);
    setDetailOpen(false);
    await reload();
  }

  function openReceipt(po: Po) {
    setReceiptPo(po);
    setReceiptKind("RECEIPT");
    setReceiptWarehouse(po.warehouseId ?? meta.warehouses[0]?.id ?? "");
    setFormError(null);
    setReceiptLines(
      (po.lines ?? [])
        .filter((l) => l.status !== "CLOSED")
        .map((l) => ({
          poLineId: l.id,
          qty: (Number(l.qtyOrdered) - Number(l.qtyReceived)).toFixed(3),
          lotCode: "",
        })),
    );
    setReceiptOpen(true);
  }

  async function openReceiptFull(row: Po) {
    const full = await fetchPo(row.id);
    if (!full.ok) {
      setState({ kind: "error", message: full.message });
      return;
    }
    setDetail(full.data);
    openReceipt(full.data);
  }

  async function onCreateReceipt() {
    if (!receiptPo) return;
    setBusy(true);
    setFormError(null);
    const res = await createReceipt(receiptPo.id, {
      version: receiptPo.version,
      warehouseId: receiptWarehouse,
      kind: receiptKind,
      lines: receiptLines
        .filter((l) => Number(l.qty) > 0)
        .map((l) => ({
          poLineId: l.poLineId,
          qty: Number(l.qty),
          lotCode: l.lotCode.trim() || undefined,
        })),
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setReceiptOpen(false);
    setReceiptPo(null);
    setDetailOpen(false);
    await reload();
  }

  const total = lines.reduce(
    (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0),
    0,
  );

  return (
    <>
      <AFilterBar
        search={
          <AInput
            id="proc-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher BC / fournisseur…"
            aria-label="Recherche"
            onKeyDown={(e) => {
              if (e.key === "Enter") void load(q, status);
            }}
          />
        }
        filters={
          <ATabs
            ariaLabel="Filtre statut bon de commande"
            items={STATUS_FILTERS}
            value={status}
            onValueChange={(id) => {
              setStatus(id);
              void load(q, id);
            }}
          />
        }
        utilities={<AListUtilities onFilter={() => void load(q, status)} />}
      />

      {state.kind === "loading" ? <ASkeleton className="h-48 w-full" /> : null}
      {state.kind === "forbidden" ? (
        <AForbiddenState message={state.message} />
      ) : null}
      {state.kind === "error" ? (
        <AErrorState
          message={state.message}
          retryable
          onRetry={() => void load(q, status)}
        />
      ) : null}
      {state.kind === "ok" && state.items.length === 0 ? (
        <AEmptyState
          title="Aucun bon de commande"
          description="Créez un BC ou convertissez une suggestion d’achat."
          actionLabel="Nouveau BC"
          onAction={openCreate}
        />
      ) : null}

      {state.kind === "ok" && state.items.length > 0 ? (
        <ASoftTable className="min-w-[820px]">
          <ASoftThead>
            <ASoftTr>
              <ASoftTh>BC</ASoftTh>
              <ASoftTh>Fournisseur</ASoftTh>
              <ASoftTh>Livraison</ASoftTh>
              <ASoftTh numeric>Total</ASoftTh>
              <ASoftTh>Statut</ASoftTh>
              <ASoftTh>Actions</ASoftTh>
            </ASoftTr>
          </ASoftThead>
          <tbody>
            {state.items.map((row) => (
              <ASoftTr key={row.id}>
                <ASoftTd>
                  <button
                    type="button"
                    className="a-mono font-medium text-a-accent underline-offset-2 hover:underline"
                    onClick={() => void openDetail(row)}
                  >
                    {row.number}
                  </button>
                </ASoftTd>
                <ASoftTd>{row.supplierName ?? "—"}</ASoftTd>
                <ASoftTd className="a-mono">
                  {row.expectedDate?.slice(0, 10) ?? "—"}
                </ASoftTd>
                <ASoftTd numeric>
                  {Number(row.amountTotal).toFixed(3)} {row.currency}
                </ASoftTd>
                <ASoftTd>
                  <ABadge tone={toneFor(row.status)}>{row.status}</ABadge>
                </ASoftTd>
                <ASoftTd>
                  <div className="flex flex-wrap gap-2">
                    {row.status === "DRAFT" ? (
                      <AButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void onTransition(row, "submit")}
                      >
                        Soumettre
                      </AButton>
                    ) : null}
                    {row.status === "SUBMITTED" ? (
                      <AButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void onTransition(row, "approve")}
                      >
                        Approuver
                      </AButton>
                    ) : null}
                    {row.status === "APPROVED" ? (
                      <AButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          setSendTarget(row);
                          setSendAddress("");
                          setSendChannel("WHATSAPP");
                          setFormError(null);
                          setSendOpen(true);
                        }}
                      >
                        Envoyer
                      </AButton>
                    ) : null}
                    {row.status === "SENT" ? (
                      <AButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void onTransition(row, "confirm")}
                      >
                        Confirmer
                      </AButton>
                    ) : null}
                    {RECEIVABLE.has(row.status) ? (
                      <AButton
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void openReceiptFull(row)}
                      >
                        Réceptionner
                      </AButton>
                    ) : null}
                    {CANCELLABLE.has(row.status) ? (
                      <AButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setCancelTarget(row)}
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

      <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
        {erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "BC fournisseur — soumission, approbation, envoi, réception stock + dette AP (D324)",
        )}
      </p>

      {/* ------------------------------------------------------------- detail */}
      <ADrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={detail ? `BC ${detail.number}` : "Bon de commande"}
        description={
          detail
            ? `${detail.supplierName ?? "—"} · ${detail.status} · ${Number(detail.amountTotal).toFixed(3)} ${detail.currency}`
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
                    <ASoftTh numeric>Commandé</ASoftTh>
                    <ASoftTh numeric>Reçu</ASoftTh>
                    <ASoftTh numeric>PU</ASoftTh>
                    <ASoftTh numeric>Total</ASoftTh>
                  </ASoftTr>
                </ASoftThead>
                <tbody>
                  {(detail.lines ?? []).map((l) => (
                    <ASoftTr key={l.id}>
                      <ASoftTd>
                        {productLabel(meta.products, l.productId)}
                      </ASoftTd>
                      <ASoftTd numeric>{Number(l.qtyOrdered).toFixed(3)}</ASoftTd>
                      <ASoftTd numeric>{Number(l.qtyReceived).toFixed(3)}</ASoftTd>
                      <ASoftTd numeric>{Number(l.unitPrice).toFixed(3)}</ASoftTd>
                      <ASoftTd numeric>{Number(l.lineTotal).toFixed(3)}</ASoftTd>
                    </ASoftTr>
                  ))}
                </tbody>
              </ASoftTable>
            </AFormSection>

            <AFormSection title="Réceptions">
              {(detail.receipts ?? []).length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-subtle">
                  Aucune réception.
                </p>
              ) : (
                <ul className="space-y-1">
                  {(detail.receipts ?? []).map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between text-[length:var(--a-text-sm)]"
                    >
                      <span className="a-mono">{r.number}</span>
                      <span className="flex items-center gap-2">
                        <ABadge tone={toneFor(r.kind)}>{r.kind}</ABadge>
                        <ABadge tone={toneFor(r.status)}>{r.status}</ABadge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AFormSection>

            <AFormSection title="Envois fournisseur">
              {(detail.messages ?? []).length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-subtle">
                  Aucun message envoyé.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(detail.messages ?? []).map((m) => (
                    <li key={m.id} className="text-[length:var(--a-text-sm)]">
                      <span className="flex items-center gap-2">
                        <ABadge tone="neutral">{m.channel}</ABadge>
                        <span className="a-mono">{m.toAddress}</span>
                        <ABadge tone={toneFor(m.status)}>{m.status}</ABadge>
                      </span>
                      {m.bodyPreview ? (
                        <span className="mt-1 block whitespace-pre-line text-a-fg-muted">
                          {m.bodyPreview}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </AFormSection>

            <AFormSection title="Entrepôt / dates">
              <dl className="space-y-1 text-[length:var(--a-text-sm)]">
                <div className="flex justify-between">
                  <dt className="text-a-fg-muted">Entrepôt</dt>
                  <dd className="a-mono">
                    {warehouseLabel(meta.warehouses, detail.warehouseId)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-a-fg-muted">Livraison souhaitée</dt>
                  <dd className="a-mono">
                    {detail.expectedDate?.slice(0, 10) ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-a-fg-muted">Envoyé / confirmé</dt>
                  <dd className="a-mono">
                    {detail.sentAt?.slice(0, 10) ?? "—"} /{" "}
                    {detail.confirmedAt?.slice(0, 10) ?? "—"}
                  </dd>
                </div>
              </dl>
              {detail.notes ? (
                <p className="mt-2 text-[length:var(--a-text-sm)] text-a-fg-muted">
                  {detail.notes}
                </p>
              ) : null}
            </AFormSection>

            <div className="flex flex-wrap gap-2">
              {RECEIVABLE.has(detail.status) ? (
                <AButton type="button" size="sm" onClick={() => openReceipt(detail)}>
                  Réceptionner
                </AButton>
              ) : null}
              {CANCELLABLE.has(detail.status) ? (
                <AButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setCancelTarget(detail)}
                >
                  Annuler le BC
                </AButton>
              ) : null}
            </div>
          </div>
        ) : null}
      </ADrawer>

      {/* ------------------------------------------------------------- create */}
      <ADrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nouveau bon de commande"
      >
        <div className="space-y-5 p-4">
          {formError ? (
            <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
              {formError}
            </p>
          ) : null}
          <AFormSection title="En-tête">
            <AField label="Fournisseur" required>
              <select
                className={softSelect}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
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
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">—</option>
                {meta.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </option>
                ))}
              </select>
            </AField>
            <AField label="Livraison souhaitée">
              <AInput
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </AField>
            <AField label="Notes">
              <AInput
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Conditions, incoterm…"
              />
            </AField>
          </AFormSection>

          <AFormSection title="Lignes">
            {lines.length === 0 ? (
              <p className="text-[length:var(--a-text-sm)] text-a-fg-subtle">
                Aucune ligne.
              </p>
            ) : null}
            {lines.map((line, idx) => (
              <div key={idx} className="mb-2 space-y-2">
                <select
                  className={softSelect}
                  value={line.productId}
                  aria-label={`Produit ligne ${idx + 1}`}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx ? { ...l, productId: e.target.value } : l,
                      ),
                    )
                  }
                >
                  {meta.products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} · {p.name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <AInput
                    value={line.qty}
                    inputMode="decimal"
                    aria-label={`Quantité ligne ${idx + 1}`}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, qty: e.target.value } : l)),
                      )
                    }
                  />
                  <AInput
                    value={line.unitPrice}
                    inputMode="decimal"
                    aria-label={`Prix unitaire ligne ${idx + 1}`}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, unitPrice: e.target.value } : l,
                        ),
                      )
                    }
                  />
                  <AButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Retirer ligne ${idx + 1}`}
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    Retirer
                  </AButton>
                </div>
              </div>
            ))}
            <AButton
              type="button"
              size="sm"
              variant="ghost"
              disabled={meta.products.length === 0}
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  {
                    productId: meta.products[0]?.id ?? "",
                    qty: "1",
                    unitPrice: "0",
                  },
                ])
              }
            >
              Ajouter ligne
            </AButton>
            <p className="mt-2 text-[length:var(--a-text-sm)] text-a-fg-muted">
              Total : {total.toFixed(3)} TND
            </p>
          </AFormSection>

          <AButton
            type="button"
            className="w-full"
            disabled={busy || !supplierId || lines.length === 0}
            onClick={() => void onCreate()}
          >
            Créer le BC
          </AButton>
        </div>
      </ADrawer>

      {/* ------------------------------------------------------------ receipt */}
      <ADrawer
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        title={receiptPo ? `Réception ${receiptPo.number}` : "Réception"}
        description="Poste le stock (Inventory) puis crée la dette fournisseur (AP)."
      >
        <div className="space-y-5 p-4">
          {formError ? (
            <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
              {formError}
            </p>
          ) : null}
          <AFormSection title="Type">
            <AField label="Nature">
              <select
                className={softSelect}
                value={receiptKind}
                onChange={(e) => setReceiptKind(e.target.value as ReceiptKind)}
              >
                <option value="RECEIPT">Réception</option>
                <option value="RETURN">Retour fournisseur</option>
              </select>
            </AField>
            <AField label="Entrepôt" required>
              <select
                className={softSelect}
                value={receiptWarehouse}
                onChange={(e) => setReceiptWarehouse(e.target.value)}
              >
                {meta.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </option>
                ))}
              </select>
            </AField>
          </AFormSection>
          <AFormSection title="Lignes reçues">
            {receiptLines.length === 0 ? (
              <p className="text-[length:var(--a-text-sm)] text-a-fg-subtle">
                Aucune ligne ouverte sur ce BC.
              </p>
            ) : null}
            {receiptLines.map((line, idx) => {
              const src = (receiptPo?.lines ?? []).find((l) => l.id === line.poLineId);
              return (
                <div key={line.poLineId} className="mb-2 space-y-2">
                  <p className="text-[length:var(--a-text-sm)]">
                    {src ? productLabel(meta.products, src.productId) : "—"}{" "}
                    <span className="text-a-fg-subtle">
                      (restant{" "}
                      {src
                        ? (Number(src.qtyOrdered) - Number(src.qtyReceived)).toFixed(3)
                        : "—"}
                      )
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <AInput
                      value={line.qty}
                      inputMode="decimal"
                      aria-label={`Quantité ligne ${idx + 1}`}
                      onChange={(e) =>
                        setReceiptLines((prev) =>
                          prev.map((l, i) =>
                            i === idx ? { ...l, qty: e.target.value } : l,
                          ),
                        )
                      }
                    />
                    <AInput
                      value={line.lotCode}
                      aria-label={`Lot ligne ${idx + 1}`}
                      placeholder="Lot (si suivi)"
                      onChange={(e) =>
                        setReceiptLines((prev) =>
                          prev.map((l, i) =>
                            i === idx ? { ...l, lotCode: e.target.value } : l,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              );
            })}
          </AFormSection>
          <AButton
            type="button"
            className="w-full"
            disabled={busy || !receiptWarehouse || receiptLines.length === 0}
            onClick={() => void onCreateReceipt()}
          >
            Créer la réception
          </AButton>
        </div>
      </ADrawer>

      {/* --------------------------------------------------------------- send */}
      <ADrawer
        open={sendOpen}
        onOpenChange={setSendOpen}
        title={sendTarget ? `Envoyer ${sendTarget.number}` : "Envoyer le BC"}
        description="Journalise le message fournisseur — l’envoi réel est branché sur le module comms."
      >
        <div className="space-y-5 p-4">
          {formError ? (
            <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
              {formError}
            </p>
          ) : null}
          <AFormSection title="Canal">
            <AField label="Canal">
              <select
                className={softSelect}
                value={sendChannel}
                onChange={(e) => setSendChannel(e.target.value as MessageChannel)}
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
              </select>
            </AField>
            <AField label="Destinataire" required>
              <AInput
                value={sendAddress}
                onChange={(e) => setSendAddress(e.target.value)}
                placeholder="+216 … ou achat@fournisseur.tn"
              />
            </AField>
          </AFormSection>
          <AButton
            type="button"
            className="w-full"
            disabled={busy || !sendAddress.trim()}
            onClick={() => void onSend()}
          >
            Envoyer
          </AButton>
        </div>
      </ADrawer>

      <AConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        risk="generic"
        consequence="Le bon de commande sera annulé — aucune réception ultérieure possible."
        confirmLabel="Annuler le BC"
        onConfirm={() => void onCancel()}
      />
    </>
  );
}
