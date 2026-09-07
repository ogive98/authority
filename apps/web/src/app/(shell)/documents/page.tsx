"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";

type DocRow = {
  id: string;
  number: string;
  title: string;
  mime: string;
  size: string;
  visibility: string;
  linkType: string;
  createdAt: string;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: DocRow[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function DocumentsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState("INTERNAL");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    try {
      const params = new URLSearchParams();
      if (query?.trim()) params.set("q", query.trim());
      const qs = params.toString();
      const res = await fetch(`/api/v1/documents${qs ? `?${qs}` : ""}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.status === 403) {
        setState({
          kind: "forbidden",
          message: "Permission documents.read requise.",
        });
        return;
      }
      if (!res.ok) {
        setState({ kind: "error", message: `HTTP ${res.status}` });
        return;
      }
      const body = (await res.json()) as { items: DocRow[] };
      setState({ kind: "ok", items: body.items });
    } catch {
      setState({ kind: "error", message: "Réseau indisponible." });
    }
  }, []);

  useEffect(() => {
    void load(q);
  }, [load]);

  async function onDownload(id: string) {
    const res = await fetch(`/api/v1/documents/${id}/download`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      setState({ kind: "error", message: "Téléchargement impossible." });
      return;
    }
    const body = (await res.json()) as { downloadUrl: string };
    window.open(body.downloadUrl, "_blank", "noopener,noreferrer");
  }

  async function submitUpload() {
    if (!title.trim() || !file) {
      setFormError("Titre et fichier requis.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const form = new FormData();
    form.set("title", title.trim());
    form.set("visibility", visibility);
    form.set("file", file);
    const res = await fetch("/api/v1/documents", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setFormError(body.message ?? `HTTP ${res.status}`);
      return;
    }
    setDrawerOpen(false);
    setTitle("");
    setFile(null);
    await load(q);
  }

  return (
    <>
      <AScreenHeader
        kicker="Documents"
        title="Bibliothèque"
        description="Fichiers SOC-09 · visibilité portal · signed URL."
        actions={
          <AButton type="button" size="sm" onClick={() => setDrawerOpen(true)}>
            Déposer un fichier
          </AButton>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label
              htmlFor="doc-q"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Recherche
            </label>
            <AInput
              id="doc-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° / titre"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q);
              }}
            />
          </div>
          <AButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load(q)}
          >
            Filtrer
          </AButton>
        </div>

        {state.kind === "loading" ? (
          <div className="space-y-2">
            <ASkeleton className="h-10 w-full" />
            <ASkeleton className="h-10 w-full" />
          </div>
        ) : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load(q)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun document"
            description="Déposez un PDF ou une pièce jointe (visibilité INTERNAL ou CUSTOMER_PORTAL)."
            actionLabel="Déposer un fichier"
            onAction={() => setDrawerOpen(true)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2">
            <table className="w-full min-w-[44rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="border-b border-a-border-subtle bg-a-surface-3/80 text-a-fg-muted">
                <tr>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Titre</th>
                  <th className="a-table-cell font-medium">Visibilité</th>
                  <th className="a-table-cell font-medium">Lien</th>
                  <th className="a-table-cell font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-a-border-subtle last:border-0 hover:bg-a-surface-3/60"
                  >
                    <td className="a-mono a-table-cell">{row.number}</td>
                    <td className="a-table-cell">{row.title}</td>
                    <td className="a-table-cell">{row.visibility}</td>
                    <td className="a-table-cell">{row.linkType}</td>
                    <td className="a-table-cell">
                      <AButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void onDownload(row.id)}
                      >
                        Télécharger
                      </AButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Déposer un fichier"
        description="Stockage MinIO via core_file · métadata doc_document."
      >
        <div className="space-y-[var(--a-space-4)]">
          {formError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-warning">
              {formError}
            </p>
          ) : null}
          <div className="space-y-1">
            <label
              htmlFor="doc-title"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Titre
            </label>
            <AInput
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="BL signé, preuve…"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="doc-vis"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Visibilité
            </label>
            <select
              id="doc-vis"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="h-9 w-full rounded-[var(--a-radius-sm)] border border-a-border-subtle bg-a-surface-1 px-3 text-[length:var(--a-text-sm)]"
            >
              <option value="INTERNAL">INTERNAL</option>
              <option value="CUSTOMER_PORTAL">CUSTOMER_PORTAL</option>
            </select>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="doc-file"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Fichier
            </label>
            <input
              id="doc-file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-[length:var(--a-text-sm)]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setDrawerOpen(false)}
              disabled={busy}
            >
              Annuler
            </AButton>
            <AButton
              type="button"
              size="sm"
              onClick={() => void submitUpload()}
              disabled={busy}
            >
              Déposer
            </AButton>
          </div>
        </div>
      </ADrawer>
    </>
  );
}
