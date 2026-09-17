"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AField,
  AFilterBar,
  AForbiddenState,
  AFormSection,
  AInput,
  AListUtilities,
  APageBody,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  erpListDescription,
} from "@/components/a";
import { softSelect } from "@/lib/soft-glass-ui";
import { ATabs } from "@/components/a/a-tabs";

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

const LINK_TYPES = [
  "NONE",
  "CUSTOMER",
  "CLAIM",
  "ORDER",
  "SHIPMENT",
  "HR_EMPLOYEE",
  "HR_BULLETIN",
] as const;

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
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "lien CUSTOMER/CLAIM/ORDER/SHIPMENT/HR · signed URL portal",
        )}
        primary={
          <AButton type="button" size="sm" onClick={() => setDrawerOpen(true)}>
            Déposer un fichier
          </AButton>
        }
      />
      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="doc-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° / titre"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q, visFilter);
              }}
            />
          }
          filters={
            <ATabs
              ariaLabel="Filtre visibilité"
              value={visFilter || "all"}
              onValueChange={(id) => {
                setVisFilter(
                  (id === "all" ? "" : id) as
                    | ""
                    | "INTERNAL"
                    | "CUSTOMER_PORTAL",
                );
              }}
              items={VIS_FILTERS.map((chip) => ({
                id: chip.id || "all",
                label: chip.label,
              }))}
            />
          }
          utilities={
            <AListUtilities onFilter={() => void load(q, visFilter)} />
          }
        />

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
          <ASoftTable className="min-w-[48rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>N°</ASoftTh>
                <ASoftTh>Titre</ASoftTh>
                <ASoftTh>Visibilité</ASoftTh>
                <ASoftTh>Lien</ASoftTh>
                <ASoftTh>Actions</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((row) => (
                <ASoftTr key={row.id}>
                  <ASoftTd className="a-mono font-semibold">{row.number}</ASoftTd>
                  <ASoftTd>{row.title}</ASoftTd>
                  <ASoftTd>
                    <ABadge tone={visibilityTone(row.visibility)}>
                      {row.visibility === "CUSTOMER_PORTAL"
                        ? "Portal"
                        : "Interne"}
                    </ABadge>
                  </ASoftTd>
                  <ASoftTd>
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
                  </ASoftTd>
                  <ASoftTd>
                    <AButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void onDownload(row.id)}
                    >
                      Télécharger
                    </AButton>
                  </ASoftTd>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        ) : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) resetForm();
        }}
        title="Déposer un fichier"
        description="Lier une cible renseigne customerId pour le partage portal."
      >
        <div className="space-y-5 p-4">
          {formError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-warning">
              {formError}
            </p>
          ) : null}
          <AFormSection title="Fichier">
            <AField label="Titre" htmlFor="doc-title">
              <AInput
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="BL signé, preuve…"
              />
            </AField>
            <AField label="Visibilité" htmlFor="doc-vis">
              <select
                id="doc-vis"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className={softSelect}
              >
                <option value="INTERNAL">INTERNAL</option>
                <option value="CUSTOMER_PORTAL">CUSTOMER_PORTAL</option>
              </select>
            </AField>
            <AField label="Fichier" htmlFor="doc-file">
              <input
                id="doc-file"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-[length:var(--a-text-sm)]"
              />
            </AField>
          </AFormSection>

          <AFormSection
            title="Lien métier"
            description="Lier une cible renseigne customerId pour le partage portal."
          >
            <AField label="Lien" htmlFor="doc-link-type">
              <select
                id="doc-link-type"
                value={linkType}
                onChange={(e) => {
                  const next = e.target.value as (typeof LINK_TYPES)[number];
                  setLinkType(next);
                  setLinkId("");
                  if (
                    next === "CLAIM" ||
                    next === "ORDER" ||
                    next === "SHIPMENT" ||
                    next === "CUSTOMER"
                  ) {
                    setVisibility("CUSTOMER_PORTAL");
                  }
                }}
                className={softSelect}
              >
                {LINK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </AField>
            {linkType !== "NONE" ? (
              <AField
                label={`Cible ${linkType}`}
                htmlFor="doc-link-id"
                hint={
                  visibility === "CUSTOMER_PORTAL"
                    ? "Le client lié verra ce fichier sur /portal/documents."
                    : undefined
                }
              >
                <select
                  id="doc-link-id"
                  value={linkId}
                  onChange={(e) => setLinkId(e.target.value)}
                  className={softSelect}
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
              </AField>
            ) : null}
            {visibility === "CUSTOMER_PORTAL" && linkType === "NONE" ? (
              <p className="text-[length:var(--a-text-xs)] text-a-warning">
                Sans lien, pas de customerId — le portal ne verra pas ce fichier.
              </p>
            ) : null}
          </AFormSection>

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
