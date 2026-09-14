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
  type AOverflowItem,
} from "@/components/a";
import {
  INSTRUMENT_STATUS_LABELS,
  fetchInstrument,
  instrumentBadgeTone,
  transitionInstrument,
  type FinInstrument,
  type InstrumentStatus,
} from "@/lib/finance";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: FinInstrument }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

const NEXT: Partial<Record<InstrumentStatus, InstrumentStatus[]>> = {
  RECEIVED: ["DEPOSITED", "PRESENTED", "REJECTED"],
  DEPOSITED: ["PRESENTED", "CLEARED", "REJECTED"],
  PRESENTED: ["CLEARED", "REJECTED"],
};

const TYPE_LABELS: Record<FinInstrument["type"], string> = {
  CHEQUE: "Chèque",
  BILL_OF_EXCHANGE: "Traite",
};

export default function FinanceInstrumentFichePage() {
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
    const res = await fetchInstrument(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({
        kind: "error",
        message: res.status === 404 ? "Instrument introuvable." : res.message,
      });
      return;
    }
    setState({ kind: "ok", data: res.data });
    setActionError(null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onTransition(status: InstrumentStatus) {
    if (!id) return;
    let rejectReason: string | undefined;
    if (status === "REJECTED") {
      const typed = window.prompt("Motif de rejet (optionnel)");
      if (typed === null) return;
      rejectReason = typed.trim() || undefined;
    }
    setBusy(true);
    setActionError(null);
    const res = await transitionInstrument(id, {
      status,
      rejectReason,
    });
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  const inst = state.kind === "ok" ? state.data : null;
  const nextStatuses = inst ? (NEXT[inst.status] ?? []) : [];

  const overflowItems = useMemo((): AOverflowItem[] => {
    const items: AOverflowItem[] = [
      {
        id: "payments",
        label: "Encaissements",
        onSelect: () => router.push("/finance/payments"),
      },
      {
        id: "banking",
        label: "Banque",
        onSelect: () => router.push("/finance/banking"),
      },
    ];
    if (inst?.paymentId) {
      items.unshift({
        id: "payment",
        label: "Ouvrir l’encaissement",
        onSelect: () => router.push(`/finance/payments/${inst.paymentId}`),
      });
    }
    return items;
  }, [inst, router]);

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/finance/instruments" className="hover:text-a-fg">
            Instruments
          </Link>
        }
        kicker="Finance"
        title={inst ? inst.number : "Instrument"}
        description="Chèque / traite — rejet restaure les créances AR (D239)."
        status={
          inst ? (
            <ABadge tone={instrumentBadgeTone(inst.status)}>
              {INSTRUMENT_STATUS_LABELS[inst.status]}
            </ABadge>
          ) : undefined
        }
        primary={
          nextStatuses[0] ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onTransition(nextStatuses[0]!)}
            >
              {INSTRUMENT_STATUS_LABELS[nextStatuses[0]!]}
            </AButton>
          ) : undefined
        }
        more={<AOverflowMenu items={overflowItems} />}
      />

      <APageBody>
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

        {inst ? (
          <ADetailGrid
            primary={
              <>
                <APageSection title="Identité">
                  <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
                    <div>
                      <dt className="text-a-fg-muted">Type</dt>
                      <dd>{TYPE_LABELS[inst.type]}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">N°</dt>
                      <dd className="a-mono">{inst.number}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Banque</dt>
                      <dd>{inst.bankName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Titulaire</dt>
                      <dd>{inst.holder ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Échéance</dt>
                      <dd className="a-mono">{inst.dueDate ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Encaissement</dt>
                      <dd>
                        <Link
                          href={`/finance/payments/${inst.paymentId}`}
                          className="a-mono text-a-accent hover:underline"
                        >
                          {inst.paymentId.slice(0, 8)}…
                        </Link>
                      </dd>
                    </div>
                    {inst.rejectReason ? (
                      <div className="sm:col-span-2">
                        <dt className="text-a-fg-muted">Motif rejet</dt>
                        <dd>{inst.rejectReason}</dd>
                      </div>
                    ) : null}
                  </dl>
                </APageSection>

                {nextStatuses.length > 1 ? (
                  <APageSection title="Transitions">
                    <div className="flex flex-wrap gap-2">
                      {nextStatuses.map((s) => (
                        <AButton
                          key={s}
                          type="button"
                          size="sm"
                          variant={s === "REJECTED" ? "ghost" : "secondary"}
                          disabled={busy}
                          onClick={() => void onTransition(s)}
                        >
                          {INSTRUMENT_STATUS_LABELS[s]}
                        </AButton>
                      ))}
                    </div>
                  </APageSection>
                ) : null}
              </>
            }
            secondary={
              <AContextPanel title="Montant & dates">
                <dl className="space-y-3 text-[length:var(--a-text-sm)]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">Montant</dt>
                    <dd className="a-mono tabular-nums font-medium">
                      {inst.amount}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">Émission</dt>
                    <dd className="a-mono">{inst.issueDate ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">Réception</dt>
                    <dd className="a-mono">{inst.receiveDate ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">Dépôt</dt>
                    <dd className="a-mono">
                      {inst.depositDate ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">Encaissé</dt>
                    <dd className="a-mono">
                      {inst.clearedAt ? inst.clearedAt.slice(0, 10) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">Rejeté</dt>
                    <dd className="a-mono">
                      {inst.rejectedAt ? inst.rejectedAt.slice(0, 10) : "—"}
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
