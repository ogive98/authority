"use client";

import { useState } from "react";
import { AButton } from "@/components/a/a-button";
import { fetchPortalDocumentDownloadClient } from "@/lib/customer-portal";

export function PortalDocumentDownloadButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    const { status, downloadUrl } = await fetchPortalDocumentDownloadClient(id);
    setBusy(false);
    if (status !== 200 || !downloadUrl) {
      setError("Téléchargement refusé.");
      return;
    }
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-1">
      <AButton
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => void onClick()}
      >
        Télécharger
      </AButton>
      {error ? (
        <p className="text-[length:var(--a-text-xs)] text-a-warning">{error}</p>
      ) : null}
    </div>
  );
}
