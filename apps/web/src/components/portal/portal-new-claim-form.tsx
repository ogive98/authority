"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AButton } from "@/components/a/a-button";
import { AInput } from "@/components/a/a-input";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  PORTAL_API,
  PORTAL_CLAIMS_PATH,
  portalClaimTypeLabel,
  type PortalClaimType,
  type PortalDelivery,
  type PortalOrder,
} from "@/lib/customer-portal";

const TYPES: PortalClaimType[] = [
  "DELIVERY",
  "QUALITY",
  "QUANTITY",
  "BILLING",
  "OTHER",
];

export function PortalNewClaimForm({
  orders,
  deliveries,
}: {
  orders: PortalOrder[];
  deliveries: PortalDelivery[];
}) {
  const router = useRouter();
  const [type, setType] = useState<PortalClaimType>("DELIVERY");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [orderId, setOrderId] = useState("");
  const [shipmentId, setShipmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setError("Sujet et description obligatoires.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(PORTAL_API.claims, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          subject: subject.trim(),
          description: description.trim(),
          orderId: orderId || undefined,
          shipmentId: shipmentId || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(body.message ?? `Erreur HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      router.push(
        body.id ? `${PORTAL_CLAIMS_PATH}/${body.id}` : PORTAL_CLAIMS_PATH,
      );
      router.refresh();
    } catch {
      setError("Réseau indisponible.");
      setBusy(false);
    }
  }

  return (
    <div>
      <AScreenHeader
        kicker="Customer Portal"
        title="Nouvelle réclamation"
        description="Création membership-scoped — pas de pièce jointe Documents (reporté)"
        actions={
          <Link
            href={PORTAL_CLAIMS_PATH}
            className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
          >
            ← Réclamations
          </Link>
        }
      />
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="mx-auto max-w-xl space-y-4 px-[var(--a-space-6)] py-[var(--a-space-5)]"
      >
        <div className="space-y-1">
          <label
            htmlFor="clm-type"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted"
          >
            Type
          </label>
          <select
            id="clm-type"
            value={type}
            onChange={(e) => setType(e.target.value as PortalClaimType)}
            className="w-full rounded-[var(--a-radius-sm)] border border-a-border-subtle bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-sm)]"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {portalClaimTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label
            htmlFor="clm-subject"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted"
          >
            Sujet
          </label>
          <AInput
            id="clm-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex. Carton endommagé"
            maxLength={160}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="clm-desc"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted"
          >
            Description
          </label>
          <textarea
            id="clm-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={2000}
            className="w-full rounded-[var(--a-radius-sm)] border border-a-border-subtle bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-sm)]"
            placeholder="Décrivez le problème…"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="clm-order"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted"
          >
            Commande liée (optionnel)
          </label>
          <select
            id="clm-order"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className="w-full rounded-[var(--a-radius-sm)] border border-a-border-subtle bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-sm)]"
          >
            <option value="">— Aucune —</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.number} · {o.status}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label
            htmlFor="clm-ship"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted"
          >
            Livraison liée (optionnel)
          </label>
          <select
            id="clm-ship"
            value={shipmentId}
            onChange={(e) => setShipmentId(e.target.value)}
            className="w-full rounded-[var(--a-radius-sm)] border border-a-border-subtle bg-a-surface-2 px-3 py-2 text-[length:var(--a-text-sm)]"
          >
            <option value="">— Aucune —</option>
            {deliveries.map((d) => (
              <option key={d.id} value={d.id}>
                {d.number} · {d.status}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <AButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => router.push(PORTAL_CLAIMS_PATH)}
          >
            Annuler
          </AButton>
          <AButton type="submit" size="sm" disabled={busy}>
            Envoyer
          </AButton>
        </div>
      </form>
    </div>
  );
}
