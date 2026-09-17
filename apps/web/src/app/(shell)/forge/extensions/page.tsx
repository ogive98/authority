"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

type Load =
  | { kind: "loading" }
  | { kind: "ok"; items: ForgeExtension[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

const ADVANCE: Partial<
  Record<ForgeExtensionStatus, ForgeExtensionStatus>
> = {
  DRAFT: "ANALYZING",
  ANALYZING: "VALIDATING",
  VALIDATING: "TESTING",
  TESTING: "READY_FOR_REVIEW",
};

export default function ForgeExtensionsPage() {
  const router = useRouter();
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
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "Manifestes tenant — données seulement · lifecycle sans saut DRAFT→ACTIVE",
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
            Nouvelle extension
          </AButton>
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "overview",
                label: "Vue d’ensemble",
                onSelect: () => router.push("/forge"),
              },
              {
                id: "requests",
                label: "Demandes",
                onSelect: () => router.push("/forge/feature-requests"),
              },
              {
                id: "metadata",
                label: "Métadonnées",
                onSelect: () => router.push("/forge/metadata"),
              },
            ]}
          />
        }
      />
      <APageBody>
        <AFilterBar
          utilities={<AListUtilities onFilter={() => void load()} />}
        />

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
          <ASoftTable className="min-w-[48rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>Clé</ASoftTh>
                <ASoftTh>Nom</ASoftTh>
                <ASoftTh>Version</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
                <ASoftTh>Actions</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((ext) => (
                <ASoftTr key={ext.id}>
                  <ASoftTd className="a-mono">{ext.key}</ASoftTd>
                  <ASoftTd>{ext.name}</ASoftTd>
                  <ASoftTd className="a-mono a-tabular">
                    {ext.manifestVersion}
                  </ASoftTd>
                  <ASoftTd>
                    <ABadge tone={forgeExtBadgeTone(ext.status)}>
                      {FORGE_EXTENSION_STATUS_LABELS[ext.status]}
                    </ABadge>
                  </ASoftTd>
                  <ASoftTd>
                    <div className="flex flex-wrap gap-2">
                      {ADVANCE[ext.status] ? (
                        <AButton
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            const next = ADVANCE[ext.status];
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
            <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
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
            <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Nom *
            </span>
            <AInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Override livraison"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Version manifeste *
            </span>
            <AInput
              value={manifestVersion}
              onChange={(e) => setManifestVersion(e.target.value)}
              className="a-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
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
