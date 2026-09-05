"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AButton } from "@/components/a/a-button";
import { PORTAL_API, PORTAL_ORDERS_PATH } from "@/lib/customer-portal";

export function PortalReorderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reorder() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${PORTAL_API.orders}/${orderId}/reorder`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        id?: string;
        message?: string | string[];
      };
      if (res.ok && body.id) {
        router.push(`${PORTAL_ORDERS_PATH}/${body.id}`);
        router.refresh();
        return;
      }
      const msg = Array.isArray(body.message)
        ? body.message.join(" ")
        : body.message;
      setError(msg ?? "Recommande refusée.");
    } catch {
      setError("API indisponible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <AButton type="button" onClick={reorder} disabled={busy}>
        {busy ? "…" : "Recommander"}
      </AButton>
      {error ? (
        <p className="text-[length:var(--a-text-xs)] text-a-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
