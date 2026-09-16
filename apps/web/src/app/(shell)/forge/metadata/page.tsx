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
  createForgeMetadata,
  FORGE_METADATA_STATUS_LABELS,
  FORGE_METADATA_TYPE_LABELS,
  fetchForgeMetadata,
  transitionForgeMetadata,
  type ForgeMetadataDefinition,
  type ForgeMetadataStatus,
  type ForgeMetadataType,
} from "@/lib/forge";
import { softTableWrap, softThead, softTr } from "@/lib/soft-glass-ui";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; items: ForgeMetadataDefinition[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

const TYPES: ForgeMetadataType[] = [
  "entity",
  "field",
  "action",
  "view",
  "form",
  "table",
  "workflow",
  "report",
  "automation",
];

function metaTone(
  status: ForgeMetadataStatus,
): "success" | "warning" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "DRAFT") return "warning";
  return "neutral";
}

export default function ForgeMetadataPage() {
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [moduleKey, setModuleKey] = useState("sales");
  const [type, setType] = useState<ForgeMetadataType>("field");
  const [commandId, setCommandId] = useState("");
  const [aliases, setAliases] = useState("");

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await fetchForgeMetadata();
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
    const schemaJson: Record<string, unknown> = {};
    if (commandId.trim()) schemaJson.commandId = commandId.trim();
    const aliasList = aliases
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    if (aliasList.length) schemaJson.aliases = aliasList;
    const res = await createForgeMetadata({
      key: key.trim(),
      type,
      moduleKey: moduleKey.trim(),
      schemaJson:
        Object.keys(schemaJson).length > 0 ? schemaJson : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    setKey("");
    setCommandId("");
    setAliases("");
    await load();
  }

  async function onTransition(id: string, status: ForgeMetadataStatus) {
    setBusy(true);
    setActionError(null);
    const res = await transitionForgeMetadata(id, status);
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
        title="Métadonnées"
        description="FrgMetadataDefinition — complète le catalog Soft Glass · schemaJson.commandId pour le pont ⌘K."
        primary={
          <AButton
            type="button"
            size="sm"
            onClick={() => {
              setFormError(null);
              setDrawerOpen(true);
            }}
          >
            Nouvelle définition
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
                id: "extensions",
                label: "Extensions",
                onSelect: () => {
                  window.location.href = "/forge/extensions";
                },
              },
              {
                id: "requests",
                label: "Demandes",
                onSelect: () => {
                  window.location.href = "/forge/feature-requests";
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
            title="Aucune métadonnée"
            description="Définissez un champ / action tenant — ACTIVE uniquement pour le pont FeatureMetadata."
            actionLabel="Nouvelle définition"
            onAction={() => setDrawerOpen(true)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <div className={softTableWrap}>
            <table className="w-full text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="px-3 py-2 font-medium">Clé</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Module</th>
                  <th className="px-3 py-2 font-medium">commandId</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((row) => {
                  const cmd =
                    typeof row.schemaJson.commandId === "string"
                      ? row.schemaJson.commandId
                      : "—";
                  return (
                    <tr key={row.id} className={softTr}>
                      <td className="px-3 py-2 a-mono">{row.key}</td>
                      <td className="px-3 py-2">
                        {FORGE_METADATA_TYPE_LABELS[row.type]}
                      </td>
                      <td className="px-3 py-2">{row.moduleKey}</td>
                      <td className="px-3 py-2 a-mono text-a-muted">{cmd}</td>
                      <td className="px-3 py-2">
                        <ABadge tone={metaTone(row.status)}>
                          {FORGE_METADATA_STATUS_LABELS[row.status]}
                        </ABadge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {row.status === "DRAFT" ? (
                            <AButton
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                void onTransition(row.id, "ACTIVE")
                              }
                            >
                              Activer
                            </AButton>
                          ) : null}
                          {row.status === "ACTIVE" ? (
                            <AButton
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                void onTransition(row.id, "DRAFT")
                              }
                            >
                              Repasser brouillon
                            </AButton>
                          ) : null}
                          {row.status !== "ARCHIVED" ? (
                            <AButton
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                void onTransition(row.id, "ARCHIVED")
                              }
                            >
                              Archiver
                            </AButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nouvelle métadonnée"
        description="DRAFT jusqu’à activation — le pont ⌘K n’utilise que ACTIVE + commandId."
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
              placeholder="sales.order.temp_field"
              className="a-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[length:var(--a-text-xs)] text-a-muted">
              Module *
            </span>
            <AInput
              value={moduleKey}
              onChange={(e) => setModuleKey(e.target.value)}
              placeholder="sales"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[length:var(--a-text-xs)] text-a-muted">
              Type
            </span>
            <select
              className="w-full rounded-[var(--a-radius-sm)] bg-transparent px-2 py-2 text-[length:var(--a-text-sm)] outline-none ring-1 ring-a-border/40"
              value={type}
              onChange={(e) => setType(e.target.value as ForgeMetadataType)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {FORGE_METADATA_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[length:var(--a-text-xs)] text-a-muted">
              commandId (pont Soft Glass)
            </span>
            <AInput
              value={commandId}
              onChange={(e) => setCommandId(e.target.value)}
              placeholder="nav-sales"
              className="a-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[length:var(--a-text-xs)] text-a-muted">
              Alias ⌘K (virgules)
            </span>
            <AInput
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="température, froid"
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
              disabled={busy || !key.trim() || !moduleKey.trim()}
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
