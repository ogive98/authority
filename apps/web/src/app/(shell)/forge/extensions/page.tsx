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
  activateForgeExtension,
  approveForgeExtension,
  FORGE_EXTENSION_STATUS_LABELS,
  forgeExtBadgeTone,
  fetchForgeExtensions,
  registerForgeExtension,
  transitionForgeExtension,
  type ForgeExtension,
  type ForgeExtensionStatus,
} from "@/lib/forge";
import { softTableWrap, softThead, softTr } from "@/lib/soft-glass-ui";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; items: ForgeExtension[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function ForgeExtensionsPage() {
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [manifestVersion, setManifestVersion] = useState("0.1.0");
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await fetchForgeExtensions();
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
    const res = await registerForgeExtension({
      key: key.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      manifestVersion: manifestVersion.trim() || "0.1.0",
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    setKey("");
    setName("");
    setDescription("");
    await load();
  }

  async function onTransition(id: string, status: ForgeExtensionStatus) {
    setBusy(true);
    setActionError(null);
    const res = await transitionForgeExtension(id, status);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await load();
  }

  async function onApprove(id: string) {
    setBusy(true);
    setActionError(null);
    const res = await approveForgeExtension(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    await load();
  }

  async function onActivate(id: string) {
    setBusy(true);
    setActionError(null);
    const res = await activateForgeExtension(id);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
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
        title="Extensions"
        description="Manifestes tenant — données seulement · lifecycle sans saut DRAFT→ACTIVE."
        primary={
          <AButton
            type="button"
            size="sm"
            onClick={() => {
              setFormError(null);
              setDrawerOpen(true);
            }}
          >
            Nouvelle extension
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
                id: "requests",
                label: "Demandes",
                onSelect: () => {
                  window.location.href = "/forge/feature-requests";
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
        {actionError ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger">
            {actionError}
          </p>
        ) : null}
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
            title="Aucune extension"
            description="Créez un manifeste DRAFT pour ce tenant."
            actionLabel="Nouvelle extension"
            onAction={() => setDrawerOpen(true)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <div className={softTableWrap}>
            <table className="w-full text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="px-3 py-2 font-medium">Clé</th>
                  <th className="px-3 py-2 font-medium">Nom</th>
                  <th className="px-3 py-2 font-medium">Version</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((ext) => (
                  <tr key={ext.id} className={softTr}>
                    <td className="px-3 py-2 a-mono">{ext.key}</td>
                    <td className="px-3 py-2">{ext.name}</td>
                    <td className="px-3 py-2 a-mono tabular-nums">
                      {ext.manifestVersion}
                    </td>
                    <td className="px-3 py-2">
                      <ABadge tone={forgeExtBadgeTone(ext.status)}>
                        {FORGE_EXTENSION_STATUS_LABELS[ext.status]}
                      </ABadge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {(
                          {
                            DRAFT: "ANALYZING",
                            ANALYZING: "VALIDATING",
                            VALIDATING: "TESTING",
                            TESTING: "READY_FOR_REVIEW",
                          } as Partial<
                            Record<ForgeExtensionStatus, ForgeExtensionStatus>
                          >
                        )[ext.status] ? (
                          <AButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => {
                              const next = (
                                {
                                  DRAFT: "ANALYZING",
                                  ANALYZING: "VALIDATING",
                                  VALIDATING: "TESTING",
                                  TESTING: "READY_FOR_REVIEW",
                                } as Partial<
                                  Record<
                                    ForgeExtensionStatus,
                                    ForgeExtensionStatus
                                  >
                                >
                              )[ext.status];
                              if (next) void onTransition(ext.id, next);
                            }}
                          >
                            Avancer
                          </AButton>
                        ) : null}
                        {ext.status === "READY_FOR_REVIEW" ? (
                          <AButton
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void onApprove(ext.id)}
                          >
                            Approuver
                          </AButton>
                        ) : null}
                        {ext.status === "APPROVED" ? (
                          <AButton
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void onActivate(ext.id)}
                          >
                            Activer
                          </AButton>
                        ) : null}
                      </div>
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
        title="Nouvelle extension"
        description="Enregistre un manifeste DRAFT — aucun code exécuté."
      >
        <div className="space-y-3">
          {formError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-danger">
              {formError}
            </p>
          ) : null}
          <label className="block space-y-1">
            <span className="text-[length:var(--a-text-xs)] text-a-muted">
              Clé *
            </span>
            <AInput
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="delivery-override"
              className="a-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[length:var(--a-text-xs)] text-a-muted">
              Nom *
            </span>
            <AInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Override livraison"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[length:var(--a-text-xs)] text-a-muted">
              Version manifeste *
            </span>
            <AInput
              value={manifestVersion}
              onChange={(e) => setManifestVersion(e.target.value)}
              className="a-mono"
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
              disabled={busy || !key.trim() || !name.trim()}
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
