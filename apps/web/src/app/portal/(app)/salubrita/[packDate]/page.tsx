"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AButton } from "@/components/a/a-button";
import { AEmptyState } from "@/components/a/a-empty-state";
import { AErrorState } from "@/components/a/a-error-state";
import { APageBody } from "@/components/a/a-page-body";
import { AScreenHeader } from "@/components/a/a-screen-header";
import { ASkeleton } from "@/components/a/a-skeleton";
import {
  SalubritaCertificateDocument,
  formatSalubritaDateFr,
  salubritaMailtoBody,
} from "@/components/salubrita/certificate-document";
import {
  PORTAL_API,
  PORTAL_SALUBRITA_PATH,
  type PortalSalubritaCertificate,
} from "@/lib/customer-portal";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; data: PortalSalubritaCertificate }
  | { kind: "error"; message: string };

export default function PortalSalubritaDetailPage() {
  const params = useParams<{ packDate: string }>();
  const packDate = params?.packDate ?? "";
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    if (!packDate) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch(
        `${PORTAL_API.salubritaCertificates}/${encodeURIComponent(packDate)}`,
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
            res.status === 403 || res.status === 401
              ? "Session expirée ou accès refusé."
              : `Impossible de charger le certificat (${res.status}).`,
        });
        return;
      }
      const data = (await res.json()) as PortalSalubritaCertificate;
      setState({ kind: "ok", data });
    } catch {
      setState({ kind: "error", message: "Réseau indisponible." });
    }
  }, [packDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const bodyText = useMemo(() => {
    if (state.kind !== "ok") return "";
    return salubritaMailtoBody(state.data.packDate, state.data.items);
  }, [state]);

  function onPrint() {
    window.print();
  }

  function onMailto() {
    const subject = encodeURIComponent(
      `Certificat de salubrité — ${formatSalubritaDateFr(packDate)}`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
  }

  function onWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(bodyText.slice(0, 3500))}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div>
      <AScreenHeader
        kicker="Portail client"
        title={`Certificat · ${formatSalubritaDateFr(packDate)}`}
        description="Impression · Outlook / e-mail · WhatsApp"
        actions={
          <Link
            href={PORTAL_SALUBRITA_PATH}
            className="text-[13px] font-medium text-a-accent hover:underline"
          >
            ← Historique
          </Link>
        }
      />
      <APageBody className="print:px-0">
        <div className="flex flex-wrap gap-2 print:hidden">
          <AButton type="button" size="sm" onClick={onPrint}>
            Imprimer
          </AButton>
          <AButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={onMailto}
          >
            Outlook / e-mail
          </AButton>
          <AButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={onWhatsApp}
          >
            WhatsApp
          </AButton>
        </div>

        {state.kind === "loading" ? <ASkeleton className="h-64 w-full" /> : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load()}
          />
        ) : null}
        {state.kind === "ok" && state.data.items.length === 0 ? (
          <AEmptyState
            title="Certificat vide"
            description="Aucun produit pour cette date."
            canAct={false}
          />
        ) : null}
        {state.kind === "ok" && state.data.items.length > 0 ? (
          <div className="salubrita-sheet bg-white text-black">
            <SalubritaCertificateDocument
              packDate={state.data.packDate}
              items={state.data.items}
            />
          </div>
        ) : null}
      </APageBody>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .salubrita-sheet, .salubrita-sheet * { visibility: visible !important; }
          .salubrita-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 12mm 14mm;
          }
        }
      `}</style>
    </div>
  );
}
