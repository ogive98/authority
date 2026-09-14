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
  PROMISE_STATUS_LABELS,
  cancelPromise,
  fetchPromise,
  promiseBadgeTone,
  type FinPromise,
} from "@/lib/finance";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: FinPromise }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function FinancePromiseFichePage() {
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
    const res = await fetchPromise(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({
        kind: "error",
        message: res.status === 404 ? "Promesse introuvable." : res.message,
      });
      return;
    }
    setState({ kind: "ok", data: res.data });
    setActionError(null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCancel() {
    if (!id) return;
    if (!window.confirm("Annuler cette promesse ouverte ?")) return;
    setBusy(true);
    setActionError(null);
    const res = await cancelPromise(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  const ptp = state.kind === "ok" ? state.data : null;

  const overflowItems = useMemo((): AOverflowItem[] => {
    const items: AOverflowItem[] = [
      {
        id: "receivables",
        label: "Créances",
        onSelect: () => router.push("/finance"),
      },
      {
        id: "payments",
        label: "Encaissements",
        onSelect: () => router.push("/finance/payments"),
      },
    ];
    if (ptp?.status === "OPEN") {
      items.push({
        id: "cancel",
        label: "Annuler",
        danger: true,
        disabled: busy,
        onSelect: () => void onCancel(),
      });
    }
    return items;
  }, [ptp, busy, router]);

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/finance/promises" className="hover:text-a-fg">
            Promesses
          </Link>
        }
        kicker="Finance"
        title={ptp ? ptp.number : "Promesse"}
        description="Engagement client sur créance AR — sans blocage ventes (D239)."
        status={
          ptp ? (
            <ABadge tone={promiseBadgeTone(ptp.status)}>
              {PROMISE_STATUS_LABELS[ptp.status]}
            </ABadge>
          ) : undefined
        }
        primary={
          ptp?.status === "OPEN" ? (
            <AButton
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void onCancel()}
            >
              Annuler
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

        {ptp ? (
          <ADetailGrid
            primary={
              <APageSection title="Identité">
                <span className="mb-3 inline-block a-mono text-[length:var(--a-text-sm)] text-a-fg-muted">
                  v{ptp.version}
                </span>
                <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
                  <div>
                    <dt className="text-a-fg-muted">Client</dt>
                    <dd>
                      {ptp.customerName ?? "—"}{" "}
                      <span className="a-mono text-a-fg-muted">
                        {ptp.customerCode}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Créance</dt>
                    <dd className="a-mono">
                      <Link
                        href="/finance"
                        className="text-a-accent hover:underline"
                      >
                        {ptp.openItemNumber ?? ptp.openItemId.slice(0, 8)}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Promis pour</dt>
                    <dd className="a-mono">{ptp.promisedDate}</dd>
                  </div>
                  <div>
                    <dt className="text-a-fg-muted">Créée le</dt>
                    <dd className="a-mono">{ptp.createdAt.slice(0, 10)}</dd>
                  </div>
                  {ptp.notes ? (
                    <div className="sm:col-span-2">
                      <dt className="text-a-fg-muted">Note</dt>
                      <dd>{ptp.notes}</dd>
                    </div>
                  ) : null}
                </dl>
              </APageSection>
            }
            secondary={
              <AContextPanel title="Montant">
                <dl className="space-y-3 text-[length:var(--a-text-sm)]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">Engagé</dt>
                    <dd className="a-mono tabular-nums font-medium">
                      {ptp.amount} {ptp.currency}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">Statut</dt>
                    <dd>
                      <ABadge tone={promiseBadgeTone(ptp.status)}>
                        {PROMISE_STATUS_LABELS[ptp.status]}
                      </ABadge>
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
