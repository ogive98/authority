"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import {
  entryBadgeTone,
  fetchEntry,
  postEntry,
  reverseEntry,
  type AccJournalEntry,
} from "@/lib/accounting";
import { useStatusLabel } from "@/hooks/use-status-label";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: AccJournalEntry }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function AccountingEntryFichePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const { label: st } = useStatusLabel();
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const res = await fetchEntry(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({
        kind: "error",
        message: res.status === 404 ? "Écriture introuvable." : res.message,
      });
      return;
    }
    setState({ kind: "ok", data: res.data });
    setActionError(null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onPost() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    const res = await postEntry(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  async function onReverse() {
    if (!id) return;
    setBusy(true);
    setActionError(null);
    const res = await reverseEntry(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    router.push(`/accounting/entries/${res.data.id}`);
  }

  const entry = state.kind === "ok" ? state.data : null;

  const totals = useMemo(() => {
    if (!entry) return { debit: 0, credit: 0 };
    let debit = 0;
    let credit = 0;
    for (const line of entry.lines ?? []) {
      debit += Number(line.debit) || 0;
      credit += Number(line.credit) || 0;
    }
    return { debit, credit };
  }, [entry]);

  const overflow: AOverflowItem[] = useMemo(() => {
    const items: AOverflowItem[] = [
      {
        id: "back",
        label: "Retour écritures",
        onSelect: () => router.push("/accounting?tab=entries"),
      },
      {
        id: "refresh",
        label: "Actualiser",
        onSelect: () => void load(),
      },
    ];
    if (entry?.status === "DRAFT") {
      items.push({
        id: "post",
        label: "Poster",
        onSelect: () => void onPost(),
      });
    }
    if (entry?.status === "POSTED") {
      items.push({
        id: "reverse",
        label: "Décomptabiliser",
        onSelect: () => void onReverse(),
      });
    }
    return items;
  }, [entry?.status, load, router]);

  const sourceHref =
    entry?.sourceType === "fin_invoice" && entry.sourceId
      ? `/finance/invoices/${entry.sourceId}`
      : entry?.sourceType === "fin_credit_note" && entry.sourceId
        ? `/finance/credit-notes`
        : entry?.sourceType === "fin_ap_bill" ||
            entry?.sourceType === "fin_ap_bill_cancel"
          ? "/finance/ap-bills"
          : entry?.sourceType === "fin_ap_payment"
            ? "/finance/ap-bills"
            : entry?.sourceType === "fin_payment_alloc" ||
                entry?.sourceType === "fin_bank_fee"
              ? "/finance/banking"
              : null;

  return (
    <>
      <AScreenHeader
        kicker="Comptabilité"
        title={entry ? `Écriture ${entry.number}` : "Écriture"}
        description="Fiche — lignes débit/crédit, poster ou décomptabiliser selon statut."
        status={
          entry ? (
            <ABadge tone={entryBadgeTone(entry.status)}>
              {st(entry.status)}
            </ABadge>
          ) : undefined
        }
        primaryAction={
          entry?.status === "DRAFT" ? (
            <AButton
              type="button"
              disabled={busy}
              onClick={() => void onPost()}
            >
              {busy ? "…" : "Poster"}
            </AButton>
          ) : entry?.status === "POSTED" ? (
            <AButton
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void onReverse()}
            >
              {busy ? "…" : "Décomptabiliser"}
            </AButton>
          ) : undefined
        }
        more={<AOverflowMenu items={overflow} />}
      />
      <APageBody>
        {state.kind === "loading" ? (
          <ASkeleton className="h-40 w-full" />
        ) : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState description={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState description={state.message} onRetry={() => void load()} />
        ) : null}
        {actionError ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger">
            {actionError}
          </p>
        ) : null}
        {entry ? (
          <ADetailGrid
            main={
              <>
                <APageSection title="Identité">
                  <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
                    <div>
                      <dt className="text-a-fg-muted">Date</dt>
                      <dd className="a-mono">{entry.entryDate}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Journal</dt>
                      <dd className="a-mono">{entry.journalCode ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Période</dt>
                      <dd className="a-mono">{entry.periodCode ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Postée le</dt>
                      <dd className="a-mono">
                        {entry.postedAt
                          ? entry.postedAt.slice(0, 19).replace("T", " ")
                          : "—"}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-a-fg-muted">Libellé</dt>
                      <dd>{entry.description ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Source</dt>
                      <dd className="a-mono">
                        {sourceHref && entry.sourceId ? (
                          <Link
                            href={sourceHref}
                            className="text-a-accent hover:underline"
                          >
                            {entry.sourceType} · {entry.sourceId.slice(0, 8)}…
                          </Link>
                        ) : (
                          <>
                            {entry.sourceType ?? "—"}
                            {entry.sourceId
                              ? ` · ${entry.sourceId.slice(0, 8)}…`
                              : ""}
                          </>
                        )}
                      </dd>
                    </div>
                  </dl>
                </APageSection>

                <APageSection title="Lignes">
                  {(entry.lines?.length ?? 0) > 0 ? (
                    <ASoftTable>
                      <ASoftThead>
                        <ASoftTr>
                          <ASoftTh>#</ASoftTh>
                          <ASoftTh>Compte</ASoftTh>
                          <ASoftTh numeric>Débit</ASoftTh>
                          <ASoftTh numeric>Crédit</ASoftTh>
                          <ASoftTh>Mémo</ASoftTh>
                        </ASoftTr>
                      </ASoftThead>
                      <tbody>
                        {entry.lines.map((line) => (
                          <ASoftTr key={line.id}>
                            <ASoftTd className="a-mono">{line.lineNo}</ASoftTd>
                            <ASoftTd>
                              <span className="a-mono">
                                {line.accountCode ?? "—"}
                              </span>{" "}
                              {line.accountName ?? ""}
                            </ASoftTd>
                            <ASoftTd numeric className="a-mono a-tabular">
                              {line.debit}
                            </ASoftTd>
                            <ASoftTd numeric className="a-mono a-tabular">
                              {line.credit}
                            </ASoftTd>
                            <ASoftTd className="text-a-fg-muted">
                              {line.memo ?? "—"}
                            </ASoftTd>
                          </ASoftTr>
                        ))}
                      </tbody>
                      <tfoot>
                        <ASoftTr>
                          <ASoftTd className="font-medium" colSpan={2}>
                            Totaux
                          </ASoftTd>
                          <ASoftTd
                            numeric
                            className="a-mono a-tabular font-medium"
                          >
                            {totals.debit.toFixed(3)}
                          </ASoftTd>
                          <ASoftTd
                            numeric
                            className="a-mono a-tabular font-medium"
                          >
                            {totals.credit.toFixed(3)}
                          </ASoftTd>
                          <ASoftTd />
                        </ASoftTr>
                      </tfoot>
                    </ASoftTable>
                  ) : (
                    <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                      Aucune ligne.
                    </p>
                  )}
                </APageSection>
              </>
            }
            context={
              <AContextPanel title="Résumé">
                <dl className="grid gap-3 text-[length:var(--a-text-sm)]">
                  <div>
                    <dt className="text-a-fg-muted">N°</dt>
                    <dd className="a-mono">{entry.number}</dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Statut</dt>
                    <dd>
                      <ABadge tone={entryBadgeTone(entry.status)}>
                        {st(entry.status)}
                      </ABadge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Débit</dt>
                    <dd className="a-mono a-tabular">
                      {totals.debit.toFixed(3)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Crédit</dt>
                    <dd className="a-mono a-tabular">
                      {totals.credit.toFixed(3)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Liste</dt>
                    <dd>
                      <Link
                        href="/accounting?tab=entries"
                        className="text-a-accent hover:underline"
                      >
                        Écritures
                      </Link>
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
