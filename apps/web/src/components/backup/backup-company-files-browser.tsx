"use client";

import { useCallback, useEffect, useState } from "react";
import { AButton, ASkeleton } from "@/components/a";
import {
  listCompanyFiles,
  mkdirCompanyFiles,
  type SpecificFoldersConfig,
} from "@/lib/backup-api";
import { softSelect } from "@/lib/d294-ui";
import { useUiT } from "@/lib/i18n/route-labels";

type DirRow = {
  relativePath: string;
  name: string;
  accessible: boolean;
};

/**
 * Shared company sandbox browser (D314) — navigate, create folders, optional multi-select.
 * Used by `/backup#files` and Specific Folders panel.
 */
export function BackupCompanyFilesBrowser({
  mode = "manage",
  selected,
  onSelectedChange,
  allowSelection = true,
  config,
}: {
  mode?: "manage" | "select";
  selected?: string[];
  onSelectedChange?: (paths: string[]) => void;
  allowSelection?: boolean;
  config?: SpecificFoldersConfig | null;
}) {
  const { t } = useUiT();
  const [path, setPath] = useState("");
  const [dirs, setDirs] = useState<DirRow[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (at: string) => {
    setLoading(true);
    setError(null);
    const res = await listCompanyFiles(at);
    setLoading(false);
    if (!res.data) {
      setError(res.message ?? "Liste indisponible");
      return;
    }
    setDirs(res.data.directories);
    setTemplates(res.data.templates);
    setHint(res.data.sandboxRootHint);
    setPath(res.data.path);
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  const crumbs = path
    ? path.split("/").filter(Boolean)
    : ([] as string[]);

  function goCrumb(index: number) {
    if (index < 0) {
      void load("");
      return;
    }
    void load(crumbs.slice(0, index + 1).join("/"));
  }

  async function createFolder(name: string) {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setFlash(null);
    const res = await mkdirCompanyFiles({ path: path || undefined, name: n });
    setBusy(false);
    if (!res.data) {
      setFlash(res.message ?? t("Création dossier échouée."));
      return;
    }
    setFlash(t("Dossier créé."));
    setNewName("");
    await load(path);
  }

  function toggleSelect(rel: string) {
    if (!allowSelection || !onSelectedChange) return;
    const cur = selected ?? [];
    onSelectedChange(
      cur.includes(rel) ? cur.filter((p) => p !== rel) : [...cur, rel],
    );
  }

  if (loading && dirs.length === 0 && !error) {
    return <ASkeleton lines={5} />;
  }

  if (error) {
    return (
      <p className="text-[length:var(--a-text-sm)] text-a-danger">{t(error)}</p>
    );
  }

  return (
    <div className="space-y-4">
      {flash ? (
        <p className="rounded-[var(--a-radius-md)] bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg">
          {t(flash)}
        </p>
      ) : null}

      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        {t("Sandbox société")}{" "}
        <span className="a-mono text-a-fg">{hint || config?.sandboxRootHint}</span>
      </p>

      <nav
        aria-label={t("Chemin sandbox")}
        className="flex flex-wrap items-center gap-1 text-[length:var(--a-text-sm)]"
      >
        <button
          type="button"
          className="text-a-accent hover:underline"
          onClick={() => goCrumb(-1)}
        >
          /
        </button>
        {crumbs.map((c, i) => (
          <span key={`${c}-${i}`} className="flex items-center gap-1">
            <span className="text-a-fg-muted">/</span>
            <button
              type="button"
              className="text-a-accent hover:underline"
              onClick={() => goCrumb(i)}
            >
              {c}
            </button>
          </span>
        ))}
      </nav>

      {mode === "manage" || allowSelection ? (
        <div className="flex flex-wrap gap-2">
          {templates.map((tpl) => {
            const exists = dirs.some((d) => d.name === tpl);
            const atRoot = !path;
            if (!atRoot) return null;
            return (
              <AButton
                key={tpl}
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy || exists}
                onClick={() => void createFolder(tpl)}
              >
                {exists ? t(`✓ ${tpl}`) : t(`+ ${tpl}`)}
              </AButton>
            );
          })}
        </div>
      ) : null}

      <ul className="space-y-2">
        {dirs.length === 0 ? (
          <li className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            {t("Aucun sous-dossier ici — créez-en un ci-dessous.")}
          </li>
        ) : (
          dirs.map((dir) => {
            const checked = (selected ?? []).includes(dir.relativePath);
            return (
              <li
                key={dir.relativePath}
                className="flex flex-wrap items-center gap-3"
              >
                {mode === "select" && allowSelection ? (
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!dir.accessible}
                    onChange={() => toggleSelect(dir.relativePath)}
                    aria-label={dir.relativePath}
                  />
                ) : null}
                <button
                  type="button"
                  className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
                  onClick={() => void load(dir.relativePath)}
                >
                  {dir.name}/
                </button>
                <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                  {dir.relativePath}
                </span>
                {!dir.accessible ? (
                  <span className="text-[length:var(--a-text-xs)] text-a-danger">
                    {t("inaccessible")}
                  </span>
                ) : null}
                {mode === "select" && allowSelection ? (
                  <AButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!dir.accessible}
                    onClick={() => toggleSelect(dir.relativePath)}
                  >
                    {checked ? t("Retirer") : t("Sélectionner")}
                  </AButton>
                ) : null}
              </li>
            );
          })
        )}
      </ul>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[length:var(--a-text-sm)]">
          <span className="text-a-fg-muted">{t("Nouveau dossier")}</span>
          <input
            className={softSelect}
            value={newName}
            disabled={busy}
            placeholder={t("ex. comptabilite")}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createFolder(newName);
              }
            }}
          />
        </label>
        <AButton
          type="button"
          variant="primary"
          disabled={busy || !newName.trim()}
          onClick={() => void createFolder(newName)}
        >
          {t("Créer")}
        </AButton>
      </div>
    </div>
  );
}
