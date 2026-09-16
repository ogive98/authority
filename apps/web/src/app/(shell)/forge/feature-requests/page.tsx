"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AOverflowMenu,
  APageBody,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import {
  createForgeFeatureRequest,
  fetchForgeFeatureRequests,
  FORGE_FR_STATUS_LABELS,
  type ForgeFeatureRequest,
} from "@/lib/forge";
import { softTableWrap, softThead, softTr } from "@/lib/soft-glass-ui";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; items: ForgeFeatureRequest[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function ForgeFeatureRequestsPage() {
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await fetchForgeFeatureRequests();
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({ kind: "ok", items: res.data.items });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    setBusy(true);
    setFormError(null);
    const res = await createForgeFeatureRequest({
      title: title.trim(),
      description: description.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    setTitle("");
    setDescription("");
    await load();
  }

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/forge" className="hover:text-a-fg">
            FORGE
          </Link>
        }
        kicker="FORGE"
        title="Demandes"
        description="Intake humain — pas d’implémentation automatique en Phase 1."
        primary={
          <AButton
            type="button"
            size="sm"
            onClick={() => {
              setFormError(null);
              setDrawerOpen(true);
            }}
          >
            Nouvelle demande
          </AButton>
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "overview",
                label: "Vue d’ensemble",
                onSelect: () => {
                  window.location.href = "/forge";
                },
              },
              {
                id: "ext",
                label: "Extensions",
                onSelect: () => {
                  window.location.href = "/forge/extensions";
                },
              },
              {
                id: "metadata",
                label: "Métadonnées",
                onSelect: () => {
                  window.location.href = "/forge/metadata";
                },
              },
            ]}
          />
        }
      />
      <APageBody>
        {state.kind === "loading" ? (
          <ASkeleton className="h-24 w-full" />
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
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucune demande"
            description="Saisissez un besoin tenant — analyse manuelle ensuite."
            actionLabel="Nouvelle demande"
            onAction={() => setDrawerOpen(true)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <div className={softTableWrap}>
            <table className="w-full text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="px-3 py-2 font-medium">Titre</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 font-medium text-right">Priorité</th>
                  <th className="px-3 py-2 font-medium">Créée</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((fr) => (
                  <tr key={fr.id} className={softTr}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{fr.title}</div>
                      {fr.description ? (
                        <div className="text-[length:var(--a-text-xs)] text-a-muted">
                          {fr.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <ABadge tone="neutral">
                        {FORGE_FR_STATUS_LABELS[fr.status]}
                      </ABadge>
                    </td>
                    <td className="px-3 py-2 text-right a-mono tabular-nums">
                      {fr.priority}
                    </td>
                    <td className="px-3 py-2 a-mono tabular-nums text-a-muted">
                      {fr.createdAt.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nouvelle demande"
        description="Pas d’agent IA — stockage et suivi seulement."
      >
        <div className="space-y-3">
          {formError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-danger">
              {formError}
            </p>
          ) : null}
          <label className="block space-y-1">
            <span className="text-[length:var(--a-text-xs)] text-a-muted">
              Titre *
            </span>
            <AInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Champ température produit"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[length:var(--a-text-xs)] text-a-muted">
              Description
            </span>
            <AInput
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <AButton
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => setDrawerOpen(false)}
            >
              {LAYOUT_ACTIONS.cancel}
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy || !title.trim()}
              onClick={() => void submit()}
            >
              {LAYOUT_ACTIONS.save}
            </AButton>
          </div>
        </div>
      </ADrawer>
    </>
  );
}
