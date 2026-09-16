"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AInput,
  AListUtilities,
  AOverflowMenu,
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
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import {
  createForgeFeatureRequest,
  fetchForgeFeatureRequests,
  FORGE_FR_STATUS_LABELS,
  type ForgeFeatureRequest,
} from "@/lib/forge";

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
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "Intake humain — pas d’implémentation automatique en Phase 1",
        )}
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
        <AFilterBar
          utilities={<AListUtilities onFilter={() => void load()} />}
        />

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
          <ASoftTable className="min-w-[40rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>Titre</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
                <ASoftTh numeric>Priorité</ASoftTh>
                <ASoftTh>Créée</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((fr) => (
                <ASoftTr key={fr.id}>
                  <ASoftTd>
                    <div className="font-medium">{fr.title}</div>
                    {fr.description ? (
                      <div className="text-[length:var(--a-text-xs)] text-a-muted">
                        {fr.description}
                      </div>
                    ) : null}
                  </ASoftTd>
                  <ASoftTd>
                    <ABadge tone="neutral">
                      {FORGE_FR_STATUS_LABELS[fr.status]}
                    </ABadge>
                  </ASoftTd>
                  <ASoftTd numeric>{fr.priority}</ASoftTd>
                  <ASoftTd className="a-mono tabular-nums text-a-muted">
                    {fr.createdAt.slice(0, 10)}
                  </ASoftTd>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
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
