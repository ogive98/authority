"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ABadge,
  AButton,
  AContextPanel,
  ADetailGrid,
  AErrorState,
  AForbiddenState,
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
  type AOverflowItem,
} from "@/components/a";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import {
  CREDIT_NOTE_STATUS_LABELS,
  cancelCreditNote,
  creditNoteBadgeTone,
  fetchCreditNote,
  issueCreditNote,
  type FinCreditNote,
} from "@/lib/finance";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: FinCreditNote }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function FinanceCreditNoteFichePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const res = await fetchCreditNote(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({
        kind: "error",
        message: res.status === 404 ? "Avoir introuvable." : res.message,
      });
      return;
    }
    setState({ kind: "ok", data: res.data });
    setActionError(null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onIssue() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    const res = await issueCreditNote(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  async function onCancel() {
    if (!id) return;
    if (!window.confirm("Annuler ce brouillon d’avoir ?")) return;
    setBusy(true);
    setActionError(null);
    const res = await cancelCreditNote(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  const cn = state.kind === "ok" ? state.data : null;

  const overflowItems = useMemo((): AOverflowItem[] => {
    if (!cn || cn.status !== "DRAFT") return [];
    return [
      {
        id: "cancel",
        label: "Annuler",
        danger: true,
        disabled: busy,
        onSelect: () => void onCancel(),
      },
    ];
  }, [cn, busy]);

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/finance/credit-notes" className="hover:text-a-fg">
            Avoirs
          </Link>
        }
        kicker="Finance"
        title={cn ? cn.number : "Avoir"}
        description="Fiche Soft Glass — lignes, AR appliqué / non appliqué (D239)."
        status={
          cn ? (
            <ABadge tone={creditNoteBadgeTone(cn.status)}>
              {CREDIT_NOTE_STATUS_LABELS[cn.status]}
            </ABadge>
          ) : undefined
        }
        primary={
          cn?.status === "DRAFT" ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onIssue()}
            >
              Émettre
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
        <ExpertiseHintsStrip keys={["tax.fodec", "tax.timbre", "tax.ras", "tax.tej"]} />

        {actionError ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger">
            {actionError}
          </p>
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
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load()}
          />
        ) : null}

        {cn ? (
          <ADetailGrid
            primary={
              <>
                <APageSection title="Identité">
                  <span className="mb-3 inline-block a-mono text-[length:var(--a-text-sm)] text-a-fg-muted">
                    v{cn.version}
                  </span>
                  <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
                    <div>
                      <dt className="text-a-fg-muted">Client</dt>
                      <dd>
                        {cn.customerName ?? "—"}{" "}
                        <span className="a-mono text-a-fg-muted">
                          {cn.customerCode}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Facture source</dt>
                      <dd>
                        <Link
                          href={`/finance/invoices/${cn.invoiceId}`}
                          className="a-mono text-a-accent hover:underline"
                        >
                          {cn.invoiceNumber ?? cn.invoiceId.slice(0, 8)}
                        </Link>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Émis le</dt>
                      <dd className="a-mono">
                        {cn.issuedAt ? cn.issuedAt.slice(0, 10) : "—"}
                      </dd>
                    </div>
                    {cn.reason ? (
                      <div>
                        <dt className="text-a-fg-muted">Motif</dt>
                        <dd>{cn.reason}</dd>
                      </div>
                    ) : null}
                    {cn.notes ? (
                      <div className="sm:col-span-2">
                        <dt className="text-a-fg-muted">Notes</dt>
                        <dd>{cn.notes}</dd>
                      </div>
                    ) : null}
                  </dl>
                </APageSection>

                <APageSection title="Lignes">
                  {(cn.lines?.length ?? 0) > 0 ? (
                    <ASoftTable>
                      <ASoftThead>
                        <ASoftTr>
                          <ASoftTh>#</ASoftTh>
                          <ASoftTh>Description</ASoftTh>
                          <ASoftTh numeric>Qté</ASoftTh>
                          <ASoftTh numeric>PU HT</ASoftTh>
                          <ASoftTh>TVA</ASoftTh>
                          <ASoftTh numeric>TTC</ASoftTh>
                        </ASoftTr>
                      </ASoftThead>
                      <tbody>
                        {cn.lines.map((l) => (
                          <ASoftTr key={l.id}>
                            <ASoftTd className="a-mono">{l.lineNo}</ASoftTd>
                            <ASoftTd>{l.description}</ASoftTd>
                            <ASoftTd numeric className="a-mono tabular-nums">
                              {l.qty}
                            </ASoftTd>
                            <ASoftTd numeric className="a-mono tabular-nums">
                              {l.unitPriceHt}
                            </ASoftTd>
                            <ASoftTd className="a-mono">
                              {l.taxCode ?? "—"}
                            </ASoftTd>
                            <ASoftTd numeric className="a-mono tabular-nums">
                              {l.amountTtc}
                            </ASoftTd>
                          </ASoftTr>
                        ))}
                      </tbody>
                    </ASoftTable>
                  ) : (
                    <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                      Aucune ligne.
                    </p>
                  )}
                </APageSection>
              </>
            }
            secondary={
              <AContextPanel title="Montants">
                <dl className="space-y-3 text-[length:var(--a-text-sm)]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">HT</dt>
                    <dd className="a-mono tabular-nums">{cn.amountHt}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">TVA</dt>
                    <dd className="a-mono tabular-nums">{cn.amountTax}</dd>
                  </div>
                  {cn.amountFodec != null && Number(cn.amountFodec) > 0 ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-a-fg-muted">FODEC</dt>
                      <dd className="a-mono tabular-nums">{cn.amountFodec}</dd>
                    </div>
                  ) : null}
                  {cn.amountTimbre != null && Number(cn.amountTimbre) > 0 ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-a-fg-muted">Timbre</dt>
                      <dd className="a-mono tabular-nums">{cn.amountTimbre}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-4 border-t border-transparent pt-2">
                    <dt className="font-medium">TTC</dt>
                    <dd className="a-mono tabular-nums font-medium">
                      {cn.amountTotal} {cn.currency}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">Appliqué AR</dt>
                    <dd className="a-mono tabular-nums">
                      {cn.amountAppliedToAr}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">Non appliqué</dt>
                    <dd className="a-mono tabular-nums">
                      {cn.amountUnapplied}
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
