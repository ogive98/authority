"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ABadge,
  AButton,
  AContextPanel,
  AErrorState,
  AForbiddenState,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import {
  cancelReturnsRma,
  createRmaCreditNote,
  DISPOSITION_LABELS,
  fetchReturnsRma,
  postReturnsRma,
  RMA_STATUS_LABELS,
  type ReturnsRma,
  type ReturnsRmaStatus,
} from "@/lib/returns";

function rmaBadgeTone(
  status: ReturnsRmaStatus,
): "success" | "warning" | "neutral" {
  if (status === "POSTED") return "success";
  if (status === "CANCELLED") return "warning";
  return "neutral";
}

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: ReturnsRma }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function ReturnsRmaFichePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const res = await fetchReturnsRma(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({
        kind: "error",
        message: res.status === 404 ? "Retour introuvable." : res.message,
      });
      return;
    }
    setState({ kind: "ok", data: res.data });
    setError(null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPost() {
    if (!id) return;
    setBusy(true);
    setError(null);
    const res = await postReturnsRma(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  async function onCancel() {
    if (!id) return;
    setBusy(true);
    setError(null);
    const res = await cancelReturnsRma(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  async function onCreateCn() {
    if (!id) return;
    setBusy(true);
    setError(null);
    const res = await createRmaCreditNote(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
    if (res.data.creditNoteId) {
      router.push(`/finance/credit-notes/${res.data.creditNoteId}`);
    }
  }

  const rma = state.kind === "ok" ? state.data : null;

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <span className="inline-flex flex-wrap items-center gap-1">
            <Link href="/" className="hover:text-a-fg">
              Ventes
            </Link>
            <span aria-hidden>/</span>
            <Link href="/sales/returns" className="hover:text-a-fg">
              Retours
            </Link>
          </span>
        }
        kicker="Retours"
        title={rma ? rma.number : "RMA"}
        description="Poster : restock stock · auto-avoir DRAFT si facture livraison · CTA manuel sinon (D317)."
        status={
          rma ? (
            <ABadge tone={rmaBadgeTone(rma.status)}>
              {RMA_STATUS_LABELS[rma.status]}
            </ABadge>
          ) : undefined
        }
        primary={
          rma?.status === "DRAFT" ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onPost()}
            >
              Poster
            </AButton>
          ) : rma?.status === "POSTED" && !rma.creditNoteId ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onCreateCn()}
            >
              Créer avoir
            </AButton>
          ) : rma?.status === "POSTED" && rma.creditNoteId ? (
            <AButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                router.push(`/finance/credit-notes/${rma.creditNoteId}`)
              }
            >
              Ouvrir avoir
            </AButton>
          ) : undefined
        }
        more={
          rma?.status === "DRAFT" ? (
            <AButton
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void onCancel()}
            >
              {LAYOUT_ACTIONS.cancel}
            </AButton>
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

        {rma ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
            <div className="space-y-4">
              <APageSection title="En-tête">
                <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
                  <div>
                    <dt className="text-a-fg-muted">Livraison</dt>
                    <dd className="a-mono">
                      {rma.shipmentNumber ?? rma.shipmentId}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Commande</dt>
                    <dd>
                      <Link
                        href={`/sales/${rma.orderId}`}
                        className="a-mono text-a-accent hover:underline"
                      >
                        {rma.orderNumber ?? rma.orderId}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Client</dt>
                    <dd>
                      <span className="a-mono text-a-fg-muted">
                        {rma.customerCode}
                      </span>{" "}
                      {rma.customerName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Entrepôt</dt>
                    <dd className="a-mono">{rma.warehouseCode ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Notes</dt>
                    <dd>{rma.notes ?? "—"}</dd>
                  </div>
                </dl>
              </APageSection>

              <APageSection title="Lignes">
                <ASoftTable>
                  <ASoftThead>
                    <ASoftTr>
                      <ASoftTh>#</ASoftTh>
                      <ASoftTh>Produit</ASoftTh>
                      <ASoftTh numeric>Qté</ASoftTh>
                      <ASoftTh>Disposition</ASoftTh>
                      <ASoftTh numeric>PU</ASoftTh>
                    </ASoftTr>
                  </ASoftThead>
                  <tbody>
                    {rma.lines.map((l) => (
                      <ASoftTr key={l.id}>
                        <ASoftTd className="a-mono">{l.lineNo}</ASoftTd>
                        <ASoftTd>
                          <span className="a-mono text-a-fg-muted">
                            {l.productSku}
                          </span>{" "}
                          {l.productName}
                        </ASoftTd>
                        <ASoftTd numeric>{l.qty}</ASoftTd>
                        <ASoftTd>{DISPOSITION_LABELS[l.disposition]}</ASoftTd>
                        <ASoftTd numeric>{l.unitPrice}</ASoftTd>
                      </ASoftTr>
                    ))}
                  </tbody>
                </ASoftTable>
              </APageSection>
            </div>

            <AContextPanel title="Liens">
              <dl className="space-y-3 text-[length:var(--a-text-sm)]">
                <div>
                  <dt className="text-a-fg-muted">Facture</dt>
                  <dd className="a-mono">{rma.invoiceNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-a-fg-muted">Avoir</dt>
                  <dd>
                    {rma.creditNoteId ? (
                      <Link
                        href={`/finance/credit-notes/${rma.creditNoteId}`}
                        className="a-mono text-a-accent hover:underline"
                      >
                        {rma.creditNoteNumber ?? "Ouvrir"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </dl>
            </AContextPanel>
          </div>
        ) : null}
      </APageBody>
    </>
  );
}
