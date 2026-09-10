"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AButton } from "@/components/a/a-button";
import { AInput } from "@/components/a/a-input";
import { PORTAL_API } from "@/lib/customer-portal";

export function PortalClaimDocumentUpload({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit() {
    if (!title.trim() || !file) {
      setError("Titre et fichier requis.");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(false);
    const form = new FormData();
    form.set("title", title.trim());
    form.set("linkType", "CLAIM");
    form.set("linkId", claimId);
    form.set("file", file);
    try {
      const res = await fetch(PORTAL_API.documents, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      setBusy(false);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setError(body.message ?? `HTTP ${res.status}`);
        return;
      }
      setTitle("");
      setFile(null);
      setOk(true);
      router.refresh();
    } catch {
      setBusy(false);
      setError("Réseau indisponible.");
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--a-radius-md)]  bg-a-surface-2 p-4">
      <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
        Ajouter une pièce
      </p>
      {error ? (
        <p className="text-[length:var(--a-text-sm)] text-a-warning">{error}</p>
      ) : null}
      {ok ? (
        <p className="text-[length:var(--a-text-sm)] text-a-success-fg">
          Fichier envoyé.
        </p>
      ) : null}
      <div className="space-y-1">
        <label
          htmlFor="portal-doc-title"
          className="text-[length:var(--a-text-xs)] text-a-fg-muted"
        >
          Titre
        </label>
        <AInput
          id="portal-doc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Photo carton, BL…"
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="portal-doc-file"
          className="text-[length:var(--a-text-xs)] text-a-fg-muted"
        >
          Fichier
        </label>
        <input
          id="portal-doc-file"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-[length:var(--a-text-sm)]"
        />
      </div>
      <AButton
        type="button"
        size="sm"
        disabled={busy}
        onClick={() => void onSubmit()}
      >
        {busy ? "Envoi…" : "Envoyer"}
      </AButton>
    </div>
  );
}
