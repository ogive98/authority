"use client";

import { useCallback, useEffect, useState } from "react";
import { AButton, AEmptyState, ASkeleton } from "@/components/a";
import { BackupCompanyFilesBrowser } from "@/components/backup/backup-company-files-browser";
import {
  createSpecificFoldersJob,
  fetchSpecificFolderJob,
  fetchSpecificFoldersConfig,
  previewSpecificFolders,
  specificFoldersDownloadHref,
  type SpecificFoldersConfig,
} from "@/lib/backup-api";
import { softSelect } from "@/lib/d294-ui";
import { useUiT } from "@/lib/i18n/route-labels";

type DestMode = "LOCAL_DISK" | "DOWNLOAD";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** D313/D314 — Specific folder backup under company sandbox (D294). */
export function BackupSpecificFoldersPanel({
  onDone,
}: {
  onDone?: () => void;
}) {
  const { t } = useUiT();
  const [config, setConfig] = useState<SpecificFoldersConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [dest, setDest] = useState<DestMode>("LOCAL_DISK");
  const [preview, setPreview] = useState<{
    filesIncluded: number;
    filesExcluded: number;
    totalSizeBytes: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadBackupId, setDownloadBackupId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const cfg = await fetchSpecificFoldersConfig();
    if (!cfg.data) {
      setError(cfg.message ?? "Config indisponible");
      return;
    }
    setConfig(cfg.data);
    setSelected(cfg.data.defaultSelection);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      const res = await fetchSpecificFolderJob(jobId);
      if (cancelled || !res.data) return;
      setProgress(res.data.progress);
      if (res.data.backupStatus === "VERIFIED") {
        setFlash(t("Sauvegarde dossiers terminée."));
        if (dest === "DOWNLOAD" && res.data.downloadReady) {
          setDownloadBackupId(res.data.backupId);
        }
        setJobId(null);
        onDone?.();
        return;
      }
      if (res.data.status === "FAILED" || res.data.backupStatus === "FAILED") {
        setFlash(res.data.errorMessage ?? t("Échec sauvegarde dossiers."));
        setJobId(null);
        return;
      }
      window.setTimeout(() => void tick(), 800);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [jobId, dest, onDone, t]);

  if (!config && !error) {
    return <ASkeleton lines={6} />;
  }
  if (error) {
    return (
      <p className="text-[length:var(--a-text-sm)] text-a-danger">{t(error)}</p>
    );
  }
  if (!config) return null;

  if (!config.enabled) {
    return (
      <AEmptyState
        title={t("Dossiers spécifiques désactivés")}
        description={t(
          "Activez la fonctionnalité dans Préférences → Sauvegarde.",
        )}
        actionLabel={t("Ouvrir Prefs")}
        onAction={() => {
          window.location.href = "/settings#backup";
        }}
      />
    );
  }

  async function onPreview() {
    if (selected.length === 0) return;
    setBusy(true);
    setFlash(null);
    const res = await previewSpecificFolders({
      folders: selected,
      includePatterns: config!.includePatterns,
      excludePatterns: config!.excludePatterns,
    });
    setBusy(false);
    if (!res.data) {
      setFlash(res.message ?? t("Aperçu impossible."));
      return;
    }
    setPreview(res.data);
  }

  async function onStart() {
    if (selected.length === 0) {
      setFlash(t("Sélectionnez au moins un dossier."));
      return;
    }
    const destMeta = config!.destinations[dest];
    if (!destMeta?.allowed || !destMeta?.supported) {
      setFlash(t("Destination non autorisée."));
      return;
    }
    setBusy(true);
    setFlash(null);
    setDownloadBackupId(null);
    const res = await createSpecificFoldersJob({
      folders: selected,
      destinationMode: dest,
      includePatterns: config!.includePatterns,
      excludePatterns: config!.excludePatterns,
      verifyAfterBackup: config!.verifyAfterBackup,
    });
    setBusy(false);
    if (!res.data) {
      setFlash(res.message ?? t("Création job échouée."));
      return;
    }
    setJobId(res.data.jobId);
    setProgress(0);
    setFlash(t("Job démarré — Thunder / exécution domaine."));
  }

  const unsupportedDests = Object.entries(config.destinations).filter(
    ([, v]) => !v.supported,
  );

  return (
    <div className="space-y-6">
      {flash ? (
        <p className="rounded-[var(--a-radius-md)] bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg">
          {t(flash)}
        </p>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
          {t("Dossiers métier à sauvegarder")}
        </h3>
        <BackupCompanyFilesBrowser
          mode="select"
          config={config}
          selected={selected}
          allowSelection={config.allowUserSelection}
          onSelectedChange={setSelected}
        />
        {selected.length > 0 ? (
          <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
            {t("Sélection")} :{" "}
            <span className="a-mono text-a-fg">{selected.join(", ")}</span>
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
          {t("Destination")}
        </h3>
        <select
          className={softSelect}
          value={dest}
          disabled={busy || Boolean(jobId)}
          onChange={(e) => setDest(e.target.value as DestMode)}
        >
          {(
            [
              ["LOCAL_DISK", "Disque local (artefact serveur)"],
              ["DOWNLOAD", "Téléchargement (dossiers métier uniquement)"],
            ] as const
          ).map(([value, label]) => {
            const meta = config.destinations[value];
            return (
              <option
                key={value}
                value={value}
                disabled={!meta?.allowed || !meta?.supported}
              >
                {t(label)}
                {!meta?.allowed ? ` — ${t("refusé Prefs")}` : ""}
              </option>
            );
          })}
        </select>
        {unsupportedDests.length > 0 ? (
          <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
            {t("Non supporté pour l’instant")} :{" "}
            {unsupportedDests.map(([k]) => k).join(", ")}
          </p>
        ) : null}
      </section>

      {preview ? (
        <p className="text-[length:var(--a-text-sm)] text-a-fg">
          {t("Aperçu")} : {preview.filesIncluded} {t("fichiers")} ·{" "}
          {formatBytes(preview.totalSizeBytes)} · {preview.filesExcluded}{" "}
          {t("exclus")}
        </p>
      ) : null}

      {jobId && progress != null ? (
        <p className="a-mono text-[length:var(--a-text-sm)] text-a-fg">
          {t("Progression")} : {progress}%
        </p>
      ) : null}

      {downloadBackupId ? (
        <a
          className="inline-flex text-[length:var(--a-text-sm)] text-a-accent underline"
          href={specificFoldersDownloadHref(downloadBackupId)}
        >
          {t("Télécharger l’archive métier")}
        </a>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <AButton
          type="button"
          variant="secondary"
          disabled={busy || selected.length === 0 || Boolean(jobId)}
          onClick={() => void onPreview()}
        >
          {t("Aperçu")}
        </AButton>
        <AButton
          type="button"
          variant="primary"
          disabled={busy || selected.length === 0 || Boolean(jobId)}
          onClick={() => void onStart()}
        >
          {dest === "DOWNLOAD"
            ? t("Télécharger dossiers métier")
            : t("Lancer la sauvegarde")}
        </AButton>
      </div>
    </div>
  );
}
