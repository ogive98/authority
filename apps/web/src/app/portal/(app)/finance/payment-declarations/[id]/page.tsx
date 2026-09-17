"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ABadge } from "@/components/a/a-badge";
import { AButton } from "@/components/a/a-button";
import { AErrorState } from "@/components/a/a-error-state";
import { APageBody } from "@/components/a/a-page-body";
import { APageSection } from "@/components/a/a-page-section";
import { AScreenHeader } from "@/components/a/a-screen-header";
import { ASkeleton } from "@/components/a/a-skeleton";
import {
  PORTAL_API,
  PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH,
  portalPaymentDeclarationBadgeTone,
  portalPaymentDeclarationStatusLabel,
  portalPaymentMethodLabel,
  type PortalPaymentDeclaration,
} from "@/lib/customer-portal";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: PortalPaymentDeclaration }
  | { kind: "error"; message: string };

export default function PortalPaymentDeclarationDetailPage() {
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
    try {
      const res = await fetch(
        `${PORTAL_API.financePaymentDeclarations}/${id}`,
        {
          credentials: "include",
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );
      if (!res.ok) {
        setState({
          kind: "error",
          message:
            res.status === 404
              ? "Déclaration introuvable."
              : `Erreur HTTP ${res.status}`,
        });
        return;
      }
      const data = (await res.json()) as PortalPaymentDeclaration;
      setState({ kind: "ok", data });
      setActionError(null);
    } catch {
      setState({ kind: "error", message: "Réseau indisponible." });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCancel() {
    if (!id || state.kind !== "ok") return;
    if (!window.confirm("Annuler cette déclaration soumise ?")) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(
        `${PORTAL_API.financePaymentDeclarations}/${id}/cancel`,
        {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
      } & Partial<PortalPaymentDeclaration>;
      if (!res.ok) {
        setActionError(body.message ?? `Erreur HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setState({ kind: "ok", data: body as PortalPaymentDeclaration });
      setBusy(false);
      router.refresh();
    } catch {
      setActionError("Réseau indisponible.");
      setBusy(false);
    }
  }

  const row = state.kind === "ok" ? state.data : null;

  return (
    <>
      <AScreenHeader
        kicker="Customer Portal"
        title={row ? row.number : "Déclaration"}
        description="Signalement de paiement — suivi du statut ADV."
        status={
          row ? (
            <ABadge tone={portalPaymentDeclarationBadgeTone(row.status)}>
              {portalPaymentDeclarationStatusLabel(row.status)}
            </ABadge>
          ) : undefined
        }
        actions={
          <Link
            href={PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH}
            className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
          >
            ← Déclarations
          </Link>
        }
        primary={
          row?.status === "SUBMITTED" ? (
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
      />
      <APageBody>
        {actionError ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger">
            {actionError}
          </p>
        ) : null}
        {state.kind === "loading" ? (
          <ASkeleton className="h-40 w-full" />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load()}
          />
        ) : null}
        {row ? (
          <APageSection title="Détail" bare>
            <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
              <div>
                <dt className="text-a-fg-muted">Montant</dt>
                <dd className="a-mono a-tabular font-medium">
                  {row.amount} {row.currency}
                </dd>
              </div>
              <div>
                <dt className="text-a-fg-muted">Mode</dt>
                <dd>{portalPaymentMethodLabel(row.method)}</dd>
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
                  <dt className="text-a-fg-muted">Notes</dt>
                  <dd>{row.notes}</dd>
                </div>
              ) : null}
              {row.reviewNote ? (
                <div className="sm:col-span-2">
                  <dt className="text-a-fg-muted">Note ADV</dt>
                  <dd>{row.reviewNote}</dd>
                </div>
              ) : null}
            </dl>
          </APageSection>
        ) : null}
      </APageBody>
    </>
  );
}
