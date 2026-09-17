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
  AInput,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  type AOverflowItem,
} from "@/components/a";
import {
  PAYMENT_DECLARATION_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  acknowledgePaymentDeclaration,
  fetchPaymentDeclaration,
  paymentDeclarationBadgeTone,
  rejectPaymentDeclaration,
  type FinPaymentDeclaration,
} from "@/lib/finance";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: FinPaymentDeclaration }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function FinancePaymentDeclarationFichePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const res = await fetchPaymentDeclaration(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({
        kind: "error",
        message:
          res.status === 404 ? "Déclaration introuvable." : res.message,
      });
      return;
    }
    setState({ kind: "ok", data: res.data });
    setActionError(null);
    setReviewNote(res.data.reviewNote ?? "");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAcknowledge() {
    if (!id || state.kind !== "ok") return;
    setBusy(true);
    setActionError(null);
    const res = await acknowledgePaymentDeclaration(id, {
      version: state.data.version,
      reviewNote: reviewNote.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  async function onReject() {
    if (!id || state.kind !== "ok") return;
    if (!window.confirm("Refuser cette déclaration ?")) return;
    setBusy(true);
    setActionError(null);
    const res = await rejectPaymentDeclaration(id, {
      version: state.data.version,
      reviewNote: reviewNote.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  const row = state.kind === "ok" ? state.data : null;
  const canReview = row?.status === "SUBMITTED";

  const overflowItems = useMemo((): AOverflowItem[] => {
    const items: AOverflowItem[] = [
      {
        id: "list",
        label: "Liste déclarations",
        onSelect: () => router.push("/finance/payment-declarations"),
      },
      {
        id: "payments",
        label: "Encaissements",
        onSelect: () => router.push("/finance/payments"),
      },
    ];
    if (row?.customerId) {
      items.push({
        id: "customer",
        label: "Fiche client",
        onSelect: () => router.push(`/customers/${row.customerId}`),
      });
    }
    if (canReview) {
      items.push({
        id: "reject",
        label: "Refuser",
        danger: true,
        disabled: busy,
        onSelect: () => void onReject(),
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, canReview, busy, router, reviewNote, state]);

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/finance/payment-declarations" className="hover:text-a-fg">
            Déclarations portail
          </Link>
        }
        kicker="Finance"
        title={row ? row.number : "Déclaration"}
        description="Signalement client — n’enregistre pas d’encaissement (D243)."
        status={
          row ? (
            <ABadge tone={paymentDeclarationBadgeTone(row.status)}>
              {PAYMENT_DECLARATION_STATUS_LABELS[row.status]}
            </ABadge>
          ) : undefined
        }
        primary={
          canReview ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onAcknowledge()}
            >
              Prendre en compte
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

        {row ? (
          <ADetailGrid
            primary={
              <>
                <APageSection title="Identité">
                  <span className="mb-3 inline-block a-mono text-[length:var(--a-text-sm)] text-a-fg-muted">
                    v{row.version}
                  </span>
                  <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
                    <div>
                      <dt className="text-a-fg-muted">Client</dt>
                      <dd>
                        {row.customerName ?? "—"}{" "}
                        <span className="a-mono text-a-fg-muted">
                          {row.customerCode}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Mode</dt>
                      <dd>
                        {PAYMENT_METHOD_LABELS[row.method] ?? row.method}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Date paiement</dt>
                      <dd className="a-mono">{row.paymentDate}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Référence</dt>
                      <dd className="a-mono">{row.reference ?? "—"}</dd>
                    </div>
                    {row.notes ? (
                      <div className="sm:col-span-2">
                        <dt className="text-a-fg-muted">Notes client</dt>
                        <dd>{row.notes}</dd>
                      </div>
                    ) : null}
                    {row.openItemId ? (
                      <div className="sm:col-span-2">
                        <dt className="text-a-fg-muted">Créance liée</dt>
                        <dd className="a-mono">{row.openItemId}</dd>
                      </div>
                    ) : null}
                  </dl>
                </APageSection>

                {canReview ? (
                  <APageSection title="Revue ADV">
                    <label
                      htmlFor="ppd-note"
                      className="text-[length:var(--a-text-sm)] text-a-fg-muted"
                    >
                      Note de revue (optionnelle)
                    </label>
                    <AInput
                      id="ppd-note"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="Ex. virement visible en banque"
                      className="mt-1"
                    />
                  </APageSection>
                ) : row.reviewNote ? (
                  <APageSection title="Note de revue">
                    <p className="text-[length:var(--a-text-sm)]">
                      {row.reviewNote}
                    </p>
                  </APageSection>
                ) : null}
              </>
            }
            context={
              <AContextPanel title="Montant">
                <dl className="space-y-3 text-[length:var(--a-text-sm)]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">Déclaré</dt>
                    <dd className="a-mono a-tabular font-medium">
                      {row.amount} {row.currency}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-a-fg-muted">Revue</dt>
                    <dd className="a-mono text-a-fg-muted">
                      {row.reviewedAt
                        ? row.reviewedAt.slice(0, 10)
                        : "—"}
                    </dd>
                  </div>
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    Après prise en compte, créer l’encaissement séparément —
                    aucun FinPayment automatique.
                  </p>
                </dl>
              </AContextPanel>
            }
          />
        ) : null}
      </APageBody>
    </>
  );
}
