"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import { cn } from "@/lib/utils";

type DocRow = {
  id: string;
  number: string;
  title: string;
  mime: string;
  size: string;
  visibility: string;
  linkType: string;
  linkId: string | null;
  customerId: string | null;
  createdAt: string;
};

type LinkTarget = { id: string; number: string; label: string };

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: DocRow[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

const VIS_FILTERS: Array<{
  id: "" | "INTERNAL" | "CUSTOMER_PORTAL";
  label: string;
}> = [
  { id: "", label: "Tous" },
  { id: "INTERNAL", label: "Interne" },
  { id: "CUSTOMER_PORTAL", label: "Portal" },
];

const LINK_TYPES = ["NONE", "CLAIM", "ORDER", "SHIPMENT"] as const;

const selectClass =
  "h-9 w-full rounded-[var(--a-radius-sm)] border border-a-border-subtle bg-a-surface-1 px-3 text-[length:var(--a-text-sm)]";

function visibilityTone(visibility: string) {
  return visibility === "CUSTOMER_PORTAL" ? "accent" : "neutral";
}

export default function DocumentsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [visFilter, setVisFilter] = useState<"" | "INTERNAL" | "CUSTOMER_PORTAL">(
    "",
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState("INTERNAL");
  const [linkType, setLinkType] = useState<(typeof LINK_TYPES)[number]>("NONE");
  const [linkId, setLinkId] = useState("");
  const [linkTargets, setLinkTargets] = useState<LinkTarget[]>([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(
    async (query?: string, visibility?: string) => {
      setState({ kind: "loading" });
      try {
        const params = new URLSearchParams();
        if (query?.trim()) params.set("q", query.trim());
        if (visibility) params.set("visibility", visibility);
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
    },
    [],
  );

  useEffect(() => {
    void load(q, visFilter);
  }, [load, visFilter]);

  useEffect(() => {
    if (!drawerOpen || linkType === "NONE") {
      setLinkTargets([]);
      return;
    }
    let cancelled = false;
    setLinkLoading(true);
    void (async () => {
      const params = new URLSearchParams({ linkType, limit: "30" });
      const res = await fetch(`/api/v1/documents/link-targets?${params}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (cancelled) return;
      setLinkLoading(false);
      if (!res.ok) {
        setLinkTargets([]);
        return;
      }
      const body = (await res.json()) as { items: LinkTarget[] };
      setLinkTargets(body.items);
    })();
    return () => {
      cancelled = true;
    };
  }, [drawerOpen, linkType]);

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

  function resetForm() {
    setTitle("");
    setVisibility("INTERNAL");
    setLinkType("NONE");
    setLinkId("");
    setFile(null);
    setFormError(null);
  }

  async function submitUpload() {
    if (!title.trim() || !file) {
      setFormError("Titre et fichier requis.");
      return;
    }
    if (linkType !== "NONE" && !linkId) {
      setFormError("Sélectionnez une cible de lien.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const form = new FormData();
    form.set("title", title.trim());
    form.set("visibility", visibility);
    form.set("linkType", linkType);
    if (linkId) form.set("linkId", linkId);
    form.set("file", file);
    const res = await fetch("/api/v1/documents", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
        code?: string;
      };
      setFormError(body.message ?? body.code ?? `HTTP ${res.status}`);
      return;
    }
    setDrawerOpen(false);
    resetForm();
    await load(q, visFilter);
  }

  return (
    <>
      <AScreenHeader
        kicker="Documents"
        title="Bibliothèque"
        description="Fichiers SOC-09 · lien CLAIM/ORDER/SHIPMENT · signed URL portal."
        actions={
          <AButton type="button" size="sm" onClick={() => setDrawerOpen(true)}>
            Déposer un fichier
          </AButton>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <div
          role="tablist"
          aria-label="Filtre visibilité"
          className="flex flex-wrap gap-1 border-b border-a-border-subtle"
        >
          {VIS_FILTERS.map((chip) => {
            const active = visFilter === chip.id;
            return (
              <button
                key={chip.id || "all"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() =>
                  setVisFilter(
                    chip.id as "" | "INTERNAL" | "CUSTOMER_PORTAL",
                  )
                }
                className={cn(
                  "border-b-2 px-3 py-2 text-[length:var(--a-text-sm)]",
                  active
                    ? "border-a-accent text-a-fg"
                    : "border-transparent text-a-fg-muted hover:text-a-fg",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

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
                if (e.key === "Enter") void load(q, visFilter);
              }}
            />
          </div>
          <AButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load(q, visFilter)}
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
            onRetry={() => void load(q, visFilter)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun document"
            description="Déposez un fichier et liez-le à une réclamation, commande ou livraison pour le portal."
            actionLabel="Déposer un fichier"
            onAction={() => setDrawerOpen(true)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2">
            <table className="w-full min-w-[48rem] border-collapse text-left text-[length:var(--a-text-sm)]">
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
                    <td className="a-table-cell">
                      <ABadge tone={visibilityTone(row.visibility)}>
                        {row.visibility === "CUSTOMER_PORTAL"
                          ? "Portal"
                          : "Interne"}
                      </ABadge>
                    </td>
                    <td className="a-table-cell">
                      {row.linkType === "NONE" ? (
                        <span className="text-a-fg-muted">—</span>
                      ) : (
                        <span className="a-mono text-[length:var(--a-text-xs)]">
                          {row.linkType}
                          {row.linkId
                            ? ` · ${row.linkId.slice(0, 8)}…`
                            : ""}
                        </span>
                      )}
                    </td>
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
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) resetForm();
        }}
        title="Déposer un fichier"
        description="Lier une cible renseigne customerId pour le partage portal."
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
              className={selectClass}
            >
              <option value="INTERNAL">INTERNAL</option>
              <option value="CUSTOMER_PORTAL">CUSTOMER_PORTAL</option>
            </select>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="doc-link-type"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Lien
            </label>
            <select
              id="doc-link-type"
              value={linkType}
              onChange={(e) => {
                const next = e.target.value as (typeof LINK_TYPES)[number];
                setLinkType(next);
                setLinkId("");
                if (next === "CLAIM" || next === "ORDER" || next === "SHIPMENT") {
                  setVisibility("CUSTOMER_PORTAL");
                }
              }}
              className={selectClass}
            >
              {LINK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {linkType !== "NONE" ? (
            <div className="space-y-1">
              <label
                htmlFor="doc-link-id"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Cible {linkType}
              </label>
              <select
                id="doc-link-id"
                value={linkId}
                onChange={(e) => setLinkId(e.target.value)}
                className={selectClass}
                disabled={linkLoading}
              >
                <option value="">
                  {linkLoading ? "Chargement…" : "Choisir…"}
                </option>
                {linkTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              {visibility === "CUSTOMER_PORTAL" ? (
                <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                  Le client lié verra ce fichier sur /portal/documents.
                </p>
              ) : null}
            </div>
          ) : null}
          {visibility === "CUSTOMER_PORTAL" && linkType === "NONE" ? (
            <p className="text-[length:var(--a-text-xs)] text-a-warning">
              Sans lien, pas de customerId — le portal ne verra pas ce fichier.
            </p>
          ) : null}
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
