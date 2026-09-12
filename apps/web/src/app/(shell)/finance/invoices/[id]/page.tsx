"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  AErrorState,
  AForbiddenState,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import {
  INVOICE_STATUS_LABELS,
  cancelInvoice,
  fetchInvoice,
  invoiceBadgeTone,
  issueInvoice,
  type FinInvoice,
} from "@/lib/finance";
import {
  softPageBody,
  softPanel,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: FinInvoice }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function FinanceInvoiceFichePage() {
  const params = useParams();
  const router = useRouter();
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
    const res = await fetchInvoice(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({
        kind: "error",
        message: res.status === 404 ? "Facture introuvable." : res.message,
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
    const res = await issueInvoice(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  async function onCancel() {
    if (!id) return;
    if (
      !window.confirm(
        "Annuler cette facture ? La créance ouverte sera clôturée et le GL décomptabilisé via Thunder.",
      )
    ) {
      return;
    }
    setBusy(true);
    setActionError(null);
    const res = await cancelInvoice(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  const inv = state.kind === "ok" ? state.data : null;

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title={inv ? inv.number : "Facture"}
        description="Fiche Soft Glass — HT/TVA/FODEC/timbre/TTC as-recorded (D224)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/finance/invoices"
              className="inline-flex items-center rounded-[var(--a-radius-md)] bg-a-surface-3 px-3 py-1.5 text-[length:var(--a-text-sm)] font-medium text-a-fg hover:opacity-90"
            >
              Retour
            </Link>
            {inv?.status === "DRAFT" ? (
              <AButton
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void onIssue()}
              >
                Émettre
              </AButton>
            ) : null}
            {inv?.status === "ISSUED" ? (
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  router.push(
                    `/finance/credit-notes?invoiceId=${encodeURIComponent(inv.id)}`,
                  )
                }
              >
                Avoir
              </AButton>
            ) : null}
            {inv && (inv.status === "DRAFT" || inv.status === "ISSUED") ? (
              <AButton
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void onCancel()}
              >
                Annuler
              </AButton>
            ) : null}
          </div>
        }
      />

      <div className={softPageBody}>
        <ExpertiseHintsStrip keys={["tax.fodec", "tax.timbre"]} />

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

        {inv ? (
          <>
            <section className={`${softPanel} space-y-4 p-5`}>
              <div className="flex flex-wrap items-center gap-2">
                <ABadge tone={invoiceBadgeTone(inv.status)}>
                  {INVOICE_STATUS_LABELS[inv.status]}
                </ABadge>
                <span className="a-mono text-[length:var(--a-text-sm)] text-a-fg-muted">
                  v{inv.version}
                </span>
              </div>

              <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
                <div>
                  <dt className="text-a-fg-muted">Client</dt>
                  <dd>
                    {inv.customerName ?? "—"}{" "}
                    <span className="a-mono text-a-fg-muted">
                      {inv.customerCode}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-a-fg-muted">Libellé</dt>
                  <dd>{inv.label ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-a-fg-muted">Échéance</dt>
                  <dd className="a-mono">{inv.dueDate ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-a-fg-muted">Émise le</dt>
                  <dd className="a-mono">
                    {inv.issuedAt
                      ? inv.issuedAt.slice(0, 10)
                      : "—"}
                  </dd>
                </div>
                {inv.salesOrderId ? (
                  <div>
                    <dt className="text-a-fg-muted">Commande</dt>
                    <dd>
                      <Link
                        href={`/sales/${inv.salesOrderId}`}
                        className="text-a-accent hover:underline"
                      >
                        Ouvrir Sales
                      </Link>
                    </dd>
                  </div>
                ) : null}
                {inv.openItemId ? (
                  <div>
                    <dt className="text-a-fg-muted">Créance AR</dt>
                    <dd>
                      <Link
                        href="/finance"
                        className="a-mono text-a-accent hover:underline"
                      >
                        {inv.openItemId.slice(0, 8)}…
                      </Link>
                    </dd>
                  </div>
                ) : null}
                {inv.notes ? (
                  <div className="sm:col-span-2">
                    <dt className="text-a-fg-muted">Notes</dt>
                    <dd>{inv.notes}</dd>
                  </div>
                ) : null}
              </dl>

              <dl className="grid gap-2 text-[length:var(--a-text-sm)] sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <dt className="text-a-fg-muted">HT</dt>
                  <dd className="a-mono tabular-nums font-medium">
                    {inv.amountHt}
                  </dd>
                </div>
                <div>
                  <dt className="text-a-fg-muted">TVA</dt>
                  <dd className="a-mono tabular-nums">{inv.amountTax}</dd>
                </div>
                <div>
                  <dt className="text-a-fg-muted">FODEC</dt>
                  <dd className="a-mono tabular-nums">
                    {inv.amountFodec ?? "0.000"}
                    {!inv.expertiseApplied?.fodec ? (
                      <span className="ml-1 text-[length:var(--a-text-xs)] text-a-fg-subtle">
                        (off)
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-a-fg-muted">Timbre</dt>
                  <dd className="a-mono tabular-nums">
                    {inv.amountTimbre ?? "0.000"}
                    {!inv.expertiseApplied?.timbre ? (
                      <span className="ml-1 text-[length:var(--a-text-xs)] text-a-fg-subtle">
                        (off)
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-a-fg-muted">TTC</dt>
                  <dd className="a-mono tabular-nums text-[length:var(--a-text-base)] font-semibold">
                    {inv.amountTotal} {inv.currency}
                  </dd>
                </div>
              </dl>
            </section>

            <section className={`${softPanel} overflow-hidden`}>
              <h2 className="px-5 py-3 text-[length:var(--a-text-sm)] font-semibold text-a-fg">
                Lignes
              </h2>
              {(inv.lines?.length ?? 0) > 0 ? (
                <div className={softTableWrap}>
                  <table className="w-full text-left text-[length:var(--a-text-sm)]">
                    <thead className={softThead}>
                      <tr>
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">Description</th>
                        <th className="px-4 py-3 font-medium text-right">Qté</th>
                        <th className="px-4 py-3 font-medium text-right">
                          PU HT
                        </th>
                        <th className="px-4 py-3 font-medium">TVA</th>
                        <th className="px-4 py-3 font-medium text-right">HT</th>
                        <th className="px-4 py-3 font-medium text-right">
                          Taxe
                        </th>
                        <th className="px-4 py-3 font-medium text-right">
                          TTC
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.lines.map((l) => (
                        <tr key={l.id} className={softTr}>
                          <td className="a-mono px-4 py-3">{l.lineNo}</td>
                          <td className="px-4 py-3">{l.description}</td>
                          <td className="a-mono px-4 py-3 text-right tabular-nums">
                            {l.qty}
                          </td>
                          <td className="a-mono px-4 py-3 text-right tabular-nums">
                            {l.unitPriceHt}
                          </td>
                          <td className="a-mono px-4 py-3 text-a-fg-muted">
                            {l.taxCode ?? "—"}
                          </td>
                          <td className="a-mono px-4 py-3 text-right tabular-nums">
                            {l.amountHt}
                          </td>
                          <td className="a-mono px-4 py-3 text-right tabular-nums">
                            {l.amountTax}
                          </td>
                          <td className="a-mono px-4 py-3 text-right tabular-nums font-medium">
                            {l.amountTtc}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 pb-5 text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucune ligne (facture legacy).
                </p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
