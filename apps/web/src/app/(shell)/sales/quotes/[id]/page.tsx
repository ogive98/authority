"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ABadge,
  AButton,
  ACombobox,
  AContextPanel,
  AErrorState,
  AForbiddenState,
  AInput,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  type AComboboxOption,
  type AOverflowItem,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { suggestCustomerPrice } from "@/lib/customers";
import {
  fetchWarehouses,
  type InventoryWarehouse,
} from "@/lib/inventory";
import { searchProducts } from "@/lib/sales";
import { useUiT } from "@/lib/i18n/route-labels";
import { fetchCustomer } from "@/lib/customers";
import {
  cancelSalesQuote,
  convertSalesQuote,
  downloadSalesQuotePdf,
  fetchSalesQuote,
  printSalesQuotePdf,
  publishSalesQuotePortal,
  QUOTE_STATUS_LABELS,
  sendSalesQuote,
  updateSalesQuote,
  type SalesQuote,
  type SalesQuoteStatus,
} from "@/lib/sales-quotes";

function quoteBadgeTone(
  status: SalesQuoteStatus,
): "success" | "warning" | "accent" | "neutral" {
  if (status === "ACCEPTED") return "success";
  if (status === "SENT") return "accent";
  if (status === "CANCELLED" || status === "EXPIRED") return "warning";
  return "neutral";
}

function normalizeWaPhone(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("216")) return digits;
  if (digits.startsWith("0") && digits.length >= 8) {
    return `216${digits.slice(1)}`;
  }
  if (digits.length === 8) return `216${digits}`;
  return digits;
}

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: SalesQuote }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type LineDraft = {
  key: string;
  productId: string | null;
  productLabel: string;
  qty: string;
  unitPrice: string;
  discountPct: string;
};

export default function SalesQuoteFichePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useUiT();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [productOptsByKey, setProductOptsByKey] = useState<
    Record<string, AComboboxOption[]>
  >({});
  const [productLoadingKey, setProductLoadingKey] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const res = await fetchSalesQuote(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({
        kind: "error",
        message: res.status === 404 ? "Devis introuvable." : res.message,
      });
      return;
    }
    setState({ kind: "ok", data: res.data });
    setValidUntil(res.data.validUntil ?? "");
    setNotes(res.data.notes ?? "");
    setWarehouseId(res.data.warehouseId);
    setLines(
      res.data.lines.map((l) => ({
        key: l.id,
        productId: l.productId,
        productLabel:
          l.productSku && l.productName
            ? `${l.productSku} — ${l.productName}`
            : l.productName ?? l.productSku ?? l.productId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discountPct: l.discountPct ?? "0",
      })),
    );
    setEditing(false);
    setError(null);
  }, [id]);

  useEffect(() => {
    void load();
    void fetchWarehouses().then((res) => {
      if (res.ok) setWarehouses(res.items);
    });
  }, [load]);

  function searchProductForLine(lineKey: string, text: string) {
    setProductLoadingKey(lineKey);
    void searchProducts(text).then((res) => {
      setProductLoadingKey((k) => (k === lineKey ? null : k));
      if (!res.ok) {
        setProductOptsByKey((m) => ({ ...m, [lineKey]: [] }));
        return;
      }
      setProductOptsByKey((m) => ({
        ...m,
        [lineKey]: res.items.map((p) => ({
          id: p.id,
          label: `${p.sku} — ${p.name}`,
        })),
      }));
    });
  }

  async function onSend() {
    if (!id) return;
    setBusy(true);
    setError(null);
    const res = await sendSalesQuote(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  async function onCancelQuote() {
    if (!id) return;
    setBusy(true);
    setError(null);
    const res = await cancelSalesQuote(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
    setEditing(false);
  }

  async function onConvert() {
    if (!id) return;
    setBusy(true);
    setError(null);
    const res = await convertSalesQuote(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    router.push(`/sales/${res.data.order.id}`);
  }

  async function onPdf() {
    if (!id) return;
    setBusy(true);
    setError(null);
    const res = await downloadSalesQuotePdf(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
    }
  }

  async function onPrint() {
    if (!id) return;
    setBusy(true);
    setError(null);
    const res = await printSalesQuotePdf(id);
    setBusy(false);
    if (!res.ok) setError(res.message);
  }

  async function onMail() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    const cust = await fetchCustomer(quote.customerId);
    setBusy(false);
    if (!cust.ok) {
      setError(cust.message);
      return;
    }
    const emails = (cust.data.contacts ?? [])
      .map((c) => c.email?.trim())
      .filter((e): e is string => Boolean(e));
    if (emails.length === 0) {
      setError(
        "Aucun e-mail sur la fiche client — renseignez un contact.",
      );
      return;
    }
    const subject = encodeURIComponent(`Devis ${quote.number}`);
    const body = encodeURIComponent(
      `Bonjour,\n\nVeuillez trouver notre devis ${quote.number}` +
        ` (total ${quote.amountTotal} ${quote.currency}).\n` +
        `Le PDF a été téléchargé — joignez-le à cet e-mail.\n\nCordialement`,
    );
    // Ensure PDF is ready to attach manually
    void downloadSalesQuotePdf(id);
    window.location.href = `mailto:${encodeURIComponent(emails[0])}?subject=${subject}&body=${body}`;
  }

  async function onWhatsapp() {
    if (!quote) return;
    setBusy(true);
    setError(null);
    const cust = await fetchCustomer(quote.customerId);
    setBusy(false);
    if (!cust.ok) {
      setError(cust.message);
      return;
    }
    const phones = (cust.data.contacts ?? [])
      .map((c) => normalizeWaPhone(c.whatsapp))
      .filter(Boolean);
    if (phones.length === 0) {
      setError(
        "Aucun WhatsApp sur la fiche client — renseignez un contact.",
      );
      return;
    }
    const text = encodeURIComponent(
      `Devis ${quote.number} — total ${quote.amountTotal} ${quote.currency}.` +
        ` Disponible aussi sur le portail client (Documents).`,
    );
    window.open(
      `https://wa.me/${phones[0]}?text=${text}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function onPortal() {
    if (!id) return;
    setBusy(true);
    setError(null);
    const res = await publishSalesQuotePortal(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setError(null);
    window.open("/portal/documents", "_blank", "noopener,noreferrer");
    await load();
  }

  async function onSaveDraft() {
    if (state.kind !== "ok" || state.data.status !== "DRAFT") return;
    const lineInputs = [];
    for (const l of lines) {
      if (!l.productId) continue;
      const qty = Number(l.qty);
      const unitPrice = Number(l.unitPrice);
      const discountPct = Number(l.discountPct || "0");
      if (!Number.isFinite(qty) || qty <= 0) {
        setError("Quantité invalide.");
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        setError("Prix invalide.");
        return;
      }
      if (
        !Number.isFinite(discountPct) ||
        discountPct < 0 ||
        discountPct > 100
      ) {
        setError("Remise % invalide (0–100).");
        return;
      }
      lineInputs.push({
        productId: l.productId,
        qty,
        unitPrice,
        discountPct,
      });
    }
    if (lineInputs.length === 0) {
      setError("Au moins une ligne produit.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await updateSalesQuote(id, {
      version: state.data.version,
      warehouseId,
      validUntil: validUntil || null,
      notes: notes.trim() || null,
      lines: lineInputs,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
    setEditing(false);
  }

  const quote = state.kind === "ok" ? state.data : null;

  const overflowItems = useMemo((): AOverflowItem[] => {
    if (!quote) return [];
    const items: AOverflowItem[] = [];
    const pdfOk =
      quote.status === "DRAFT" ||
      quote.status === "SENT" ||
      quote.status === "ACCEPTED";
    if (pdfOk) {
      items.push({
        id: "pdf",
        label: t("Télécharger PDF"),
        onSelect: () => void onPdf(),
        disabled: busy,
      });
      items.push({
        id: "print",
        label: t("Imprimer"),
        onSelect: () => void onPrint(),
        disabled: busy,
      });
      items.push({
        id: "mail",
        label: t("Mail"),
        onSelect: () => void onMail(),
        disabled: busy,
      });
      items.push({
        id: "whatsapp",
        label: t("WhatsApp"),
        onSelect: () => void onWhatsapp(),
        disabled: busy,
      });
      items.push({
        id: "portal",
        label: t("Portail"),
        onSelect: () => void onPortal(),
        disabled: busy,
      });
    }
    if (quote.status === "DRAFT" && !editing) {
      items.push({
        id: "edit",
        label: LAYOUT_ACTIONS.edit,
        onSelect: () => setEditing(true),
        disabled: busy,
      });
    }
    if (quote.status === "DRAFT" && editing) {
      items.push({
        id: "cancel-edit",
        label: "Annuler édition",
        onSelect: () => void load(),
        disabled: busy,
      });
    }
    if (quote.status === "DRAFT" || quote.status === "SENT") {
      items.push({
        id: "cancel-quote",
        label: "Annuler devis",
        danger: true,
        onSelect: () => void onCancelQuote(),
        disabled: busy,
      });
    }
    return items;
  }, [quote, editing, busy, load, t]);

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <span className="inline-flex flex-wrap items-center gap-1">
            <Link href="/" className="hover:text-a-fg">
              Ventes
            </Link>
            <span aria-hidden>/</span>
            <Link href="/sales/quotes" className="hover:text-a-fg">
              Devis
            </Link>
          </span>
        }
        kicker="Ventes"
        title={quote ? quote.number : "Devis"}
        description="Brouillon → Envoyer → PDF / Imprimer / Mail · WA · Portail → Convertir (D318)."
        status={
          quote ? (
            <ABadge tone={quoteBadgeTone(quote.status)}>
              {QUOTE_STATUS_LABELS[quote.status]}
            </ABadge>
          ) : undefined
        }
        primary={
          quote?.status === "DRAFT" && editing ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onSaveDraft()}
            >
              {LAYOUT_ACTIONS.save}
            </AButton>
          ) : quote?.status === "DRAFT" && !editing ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onSend()}
            >
              Envoyer
            </AButton>
          ) : quote?.status === "SENT" ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onConvert()}
            >
              Convertir en commande
            </AButton>
          ) : quote?.status === "ACCEPTED" && quote.convertedOrderId ? (
            <AButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                router.push(`/sales/${quote.convertedOrderId}`)
              }
            >
              Ouvrir commande
            </AButton>
          ) : quote?.status === "ACCEPTED" ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onPdf()}
            >
              {t("Télécharger PDF")}
            </AButton>
          ) : undefined
        }
        more={
          overflowItems.length > 0 ? (
            <AOverflowMenu items={overflowItems} />
          ) : undefined
        }
      />

      <APageBody>
        {error ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger">{error}</p>
        ) : null}

        {state.kind === "loading" ? (
          <div className="space-y-3">
            <ASkeleton className="h-8 w-48" />
            <ASkeleton className="h-40 w-full" />
          </div>
        ) : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState message={state.message} retryable onRetry={() => void load()} />
        ) : null}

        {quote ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
            <div className="space-y-4">
              {(quote.status === "DRAFT" ||
                quote.status === "SENT" ||
                quote.status === "ACCEPTED") && (
                <APageSection bare className="flex flex-wrap gap-2">
                  <AButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void onPrint()}
                  >
                    {t("Imprimer")}
                  </AButton>
                  <AButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void onMail()}
                  >
                    {t("Mail")}
                  </AButton>
                  <AButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void onWhatsapp()}
                  >
                    {t("WhatsApp")}
                  </AButton>
                  <AButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void onPortal()}
                  >
                    {t("Portail")}
                  </AButton>
                  <AButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void onPdf()}
                  >
                    {t("Télécharger PDF")}
                  </AButton>
                </APageSection>
              )}
              <APageSection title="En-tête">
                <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
                  <div>
                    <dt className="text-a-fg-muted">Client</dt>
                    <dd>
                      <span className="a-mono text-a-fg-muted">
                        {quote.customerCode}
                      </span>{" "}
                      {quote.customerName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Entrepôt</dt>
                    <dd>
                      {editing && quote.status === "DRAFT" ? (
                        <select
                          className="mt-1 w-full rounded-[var(--a-radius-sm)] border border-a-border bg-a-surface-2 px-2 py-1.5"
                          value={warehouseId ?? ""}
                          onChange={(e) =>
                            setWarehouseId(e.target.value || null)
                          }
                        >
                          <option value="">—</option>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.code} — {w.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        quote.warehouseCode ?? "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Valable jusqu’au</dt>
                    <dd>
                      {editing && quote.status === "DRAFT" ? (
                        <AInput
                          type="date"
                          value={validUntil}
                          onChange={(e) => setValidUntil(e.target.value)}
                        />
                      ) : (
                        <span className="a-mono">{quote.validUntil ?? "—"}</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Notes</dt>
                    <dd>
                      {editing && quote.status === "DRAFT" ? (
                        <AInput
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      ) : (
                        quote.notes ?? "—"
                      )}
                    </dd>
                  </div>
                </dl>
              </APageSection>

              <APageSection
                title="Lignes"
                action={
                  editing && quote.status === "DRAFT" ? (
                    <AButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setLines((prev) => [
                          ...prev,
                          {
                            key: `l-${Date.now()}`,
                            productId: null,
                            productLabel: "",
                            qty: "1",
                            unitPrice: "0",
                            discountPct: "0",
                          },
                        ])
                      }
                    >
                      + Ligne
                    </AButton>
                  ) : undefined
                }
              >
                {editing && quote.status === "DRAFT" ? (
                  <div className="space-y-3">
                    {lines.map((line, idx) => (
                      <div
                        key={line.key}
                        className="space-y-2 rounded-[var(--a-radius-sm)] bg-a-surface-3/60 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                            Ligne {idx + 1}
                          </span>
                          {lines.length > 1 ? (
                            <AButton
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setLines((prev) =>
                                  prev.filter((l) => l.key !== line.key),
                                )
                              }
                            >
                              Retirer
                            </AButton>
                          ) : null}
                        </div>
                        <ACombobox
                          label="Produit"
                          valueId={line.productId}
                          displayValue={line.productLabel}
                          onDisplayChange={(text) => {
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? {
                                      ...l,
                                      productLabel: text,
                                      productId: null,
                                    }
                                  : l,
                              ),
                            );
                            searchProductForLine(line.key, text);
                          }}
                          onSelect={(opt) => {
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? {
                                      ...l,
                                      productId: opt.id,
                                      productLabel: opt.label,
                                    }
                                  : l,
                              ),
                            );
                            void suggestCustomerPrice(
                              quote.customerId,
                              opt.id,
                            ).then((priceRes) => {
                              if (!priceRes.ok || priceRes.data.unitPrice == null)
                                return;
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === line.key
                                    ? {
                                        ...l,
                                        unitPrice: String(
                                          priceRes.data.unitPrice,
                                        ),
                                      }
                                    : l,
                                ),
                              );
                            });
                          }}
                          onOpen={() =>
                            searchProductForLine(line.key, line.productLabel)
                          }
                          options={productOptsByKey[line.key] ?? []}
                          loading={productLoadingKey === line.key}
                          placeholder="SKU ou nom…"
                          emptyText="Aucun produit"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                              Qté
                            </label>
                            <AInput
                              value={line.qty}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key
                                      ? { ...l, qty: e.target.value }
                                      : l,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                              PU
                            </label>
                            <AInput
                              value={line.unitPrice}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key
                                      ? { ...l, unitPrice: e.target.value }
                                      : l,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                              Remise %
                            </label>
                            <AInput
                              value={line.discountPct}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key
                                      ? { ...l, discountPct: e.target.value }
                                      : l,
                                  ),
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ASoftTable>
                    <ASoftThead>
                      <ASoftTr>
                        <ASoftTh>#</ASoftTh>
                        <ASoftTh>Produit</ASoftTh>
                        <ASoftTh numeric>Qté</ASoftTh>
                        <ASoftTh numeric>PU</ASoftTh>
                        <ASoftTh numeric>Remise %</ASoftTh>
                        <ASoftTh numeric>Total</ASoftTh>
                      </ASoftTr>
                    </ASoftThead>
                    <tbody>
                      {quote.lines.map((l) => (
                        <ASoftTr key={l.id}>
                          <ASoftTd className="a-mono">{l.lineNo}</ASoftTd>
                          <ASoftTd>
                            <span className="a-mono text-a-fg-muted">
                              {l.productSku}
                            </span>{" "}
                            {l.productName}
                          </ASoftTd>
                          <ASoftTd numeric>{l.qty}</ASoftTd>
                          <ASoftTd numeric>{l.unitPrice}</ASoftTd>
                          <ASoftTd numeric>{l.discountPct}</ASoftTd>
                          <ASoftTd numeric>{l.lineTotal}</ASoftTd>
                        </ASoftTr>
                      ))}
                    </tbody>
                  </ASoftTable>
                )}
              </APageSection>
            </div>

            <AContextPanel title="Synthèse">
              <dl className="space-y-3 text-[length:var(--a-text-sm)]">
                <div>
                  <dt className="text-a-fg-muted">Total</dt>
                  <dd className="a-mono a-tabular text-[length:var(--a-text-base)] font-medium">
                    {quote.amountTotal} {quote.currency}
                  </dd>
                </div>
                {quote.convertedOrderId ? (
                  <div>
                    <dt className="text-a-fg-muted">Commande</dt>
                    <dd>
                      <Link
                        href={`/sales/${quote.convertedOrderId}`}
                        className="text-a-accent hover:underline"
                      >
                        Ouvrir
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </AContextPanel>
          </div>
        ) : null}
      </APageBody>
    </>
  );
}
