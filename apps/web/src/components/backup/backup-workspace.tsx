"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  APageSection,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  ATabs,
} from "@/components/a";
import {
  BackupStepUpDialog,
  type BackupStepUpResult,
} from "@/components/backup/backup-step-up-dialog";
import { BackupCompanyFilesBrowser } from "@/components/backup/backup-company-files-browser";
import { BackupLocalDiskPanel } from "@/components/backup/backup-local-disk-panel";
import { BackupSpecificFoldersPanel } from "@/components/backup/backup-specific-folders-panel";
import {
  RESTORE_CONFIRM_PHRASE,
  approveRestore,
  applyRestore,
  cancelRestore,
  createBackup,
  fetchBackup,
  fetchBackupDashboard,
  fetchBackupDestinations,
  fetchBackupEffectiveSettings,
  fetchBackupJobs,
  fetchBackupPolicies,
  fetchBackups,
  fetchRestoreRequests,
  fetchSpecificFoldersConfig,
  lockBackup,
  requestRestore,
  runRetention,
  softDeleteBackup,
  testDestination,
  verifyBackup,
  type BackupDashboard,
  type BackupDestinationRow,
  type BackupEffectiveSetting,
  type BackupJobRow,
  type BackupPolicyRow,
  type BackupRow,
  type RestoreRequestRow,
} from "@/lib/backup-api";
import { softSelect } from "@/lib/d294-ui";
import { useUiT } from "@/lib/i18n/route-labels";

type TabId = "backups" | "files" | "folders" | "restore" | "ops";

type OkData = {
  dashboard: BackupDashboard;
  backups: BackupRow[];
  restoreRequests: RestoreRequestRow[];
  jobs: BackupJobRow[];
  destinations: BackupDestinationRow[];
  policies: BackupPolicyRow[];
  effective: BackupEffectiveSetting[];
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; data: OkData }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type StepUpKind =
  | { kind: "request"; backupId: string }
  | { kind: "approve"; restoreId: string }
  | { kind: "apply"; restoreId: string };

function statusLabel(status: string, locale: "fr" | "it") {
  const fr: Record<string, string> = {
    VERIFIED: "Vérifié",
    FAILED: "Échoué",
    LOCKED: "Verrouillé",
    RUNNING: "En cours",
    CORRUPTED: "Corrrompu",
    PENDING_SECOND_APPROVAL: "Attente 2ᵉ approbation",
    DRY_VALIDATED: "Dry-validé",
    APPLIED: "Appliqué",
    HEALTH_FAILED: "Santé échouée",
    REQUESTED: "Demandé",
    AUTHORIZED: "Autorisé",
    APPLYING: "Application…",
    CANCELLED: "Annulé",
    SUCCEEDED: "Réussi",
    QUEUED: "En file",
  };
  const it: Record<string, string> = {
    VERIFIED: "Verificato",
    FAILED: "Fallito",
    LOCKED: "Bloccato",
    RUNNING: "In corso",
    CORRUPTED: "Corrotto",
    PENDING_SECOND_APPROVAL: "Attesa 2ª approvazione",
    DRY_VALIDATED: "Dry-validato",
    APPLIED: "Applicato",
    HEALTH_FAILED: "Salute fallita",
    REQUESTED: "Richiesto",
    AUTHORIZED: "Autorizzato",
    APPLYING: "Applicazione…",
    CANCELLED: "Annullato",
    SUCCEEDED: "Riuscito",
    QUEUED: "In coda",
  };
  return (locale === "it" ? it : fr)[status] ?? status;
}

function formatBytes(n: number | null) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupWorkspace() {
  const { t, locale } = useUiT();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [tab, setTab] = useState<TabId>("backups");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [scope, setScope] = useState<"CONFIGURATION" | "DATABASE">(
    "CONFIGURATION",
  );
  const [stepUp, setStepUp] = useState<StepUpKind | null>(null);
  const [stepUpError, setStepUpError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BackupRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [foldersTabVisible, setFoldersTabVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (hash === "restore" || hash === "restauration") setTab("restore");
    if (hash === "ops") setTab("ops");
    if (hash === "folders" || hash === "dossiers") setTab("folders");
    if (hash === "files" || hash === "fichiers") setTab("files");
  }, []);

  useEffect(() => {
    void (async () => {
      const cfg = await fetchSpecificFoldersConfig();
      // Tab visible when API reachable (enabled or Prefs empty-state).
      setFoldersTabVisible(cfg.status !== 403 && cfg.status !== 404);
    })();
  }, []);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const [dash, list, restores, jobs, dests, policies, effective] =
      await Promise.all([
        fetchBackupDashboard(),
        fetchBackups(),
        fetchRestoreRequests(),
        fetchBackupJobs(),
        fetchBackupDestinations(),
        fetchBackupPolicies(),
        fetchBackupEffectiveSettings(),
      ]);
    if (
      dash.status === 403 ||
      list.status === 403 ||
      restores.status === 403
    ) {
      setState({
        kind: "forbidden",
        message:
          dash.message ??
          list.message ??
          restores.message ??
          "Module backup désactivé ou permission insuffisante.",
      });
      return;
    }
    if (!dash.data || !list.data) {
      setState({
        kind: "error",
        message:
          dash.message ??
          list.message ??
          "Impossible de charger les sauvegardes.",
      });
      return;
    }
    setState({
      kind: "ok",
      data: {
        dashboard: dash.data,
        backups: list.data.backups,
        restoreRequests: restores.data?.restoreRequests ?? [],
        jobs: jobs.data?.jobs ?? [],
        destinations: dests.data?.destinations ?? [],
        policies: policies.data?.policies ?? [],
        effective: effective.data?.settings ?? [],
      },
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate() {
    setBusy(true);
    setFlash(null);
    const res = await createBackup({
      scope,
      label:
        scope === "DATABASE"
          ? "ui-database-installable"
          : "ui-configuration-manifest",
    });
    setBusy(false);
    if (!res.data) {
      setFlash(res.message ?? "Création échouée.");
      return;
    }
    setFlash(
      res.data.restorable
        ? "Sauvegarde installable créée (restorable)."
        : "Manifeste créé — non restaurable.",
    );
    await load();
  }

  async function onVerify(id: string) {
    setBusy(true);
    setFlash(null);
    const res = await verifyBackup(id);
    setBusy(false);
    setFlash(
      res.data
        ? "Vérification terminée."
        : (res.message ?? "Vérification échouée."),
    );
    await load();
  }

  async function onLock(id: string) {
    setBusy(true);
    setFlash(null);
    const res = await lockBackup(id);
    setBusy(false);
    setFlash(
      res.data
        ? "Sauvegarde verrouillée."
        : (res.message ?? "Verrouillage échoué."),
    );
    await load();
  }

  async function onDelete(id: string) {
    if (
      !window.confirm(
        t(
          "Soft-supprimer cette sauvegarde ? Les verrouillées peuvent être refusées.",
        ),
      )
    ) {
      return;
    }
    setBusy(true);
    setFlash(null);
    const res = await softDeleteBackup(id);
    setBusy(false);
    if (res.status >= 400) {
      setFlash(res.message ?? "Suppression échouée.");
      return;
    }
    setFlash("Sauvegarde soft-supprimée.");
    await load();
  }

  async function onRetention() {
    setBusy(true);
    setFlash(null);
    const res = await runRetention();
    setBusy(false);
    if (!res.data) {
      setFlash(res.message ?? "Rétention échouée.");
      return;
    }
    setFlash(
      `Rétention : ${res.data.softDeleted} purgée(s), ${res.data.skippedLocked} verrouillée(s) conservée(s).`,
    );
    await load();
  }

  async function onOpenDetail(id: string) {
    setBusy(true);
    const res = await fetchBackup(id);
    setBusy(false);
    if (!res.data) {
      setFlash(res.message ?? "Détail indisponible.");
      return;
    }
    setDetail(res.data);
    setDetailOpen(true);
  }

  async function onTestDestination(id: string) {
    setBusy(true);
    setFlash(null);
    const res = await testDestination(id);
    setBusy(false);
    if (!res.data) {
      setFlash(res.message ?? "Test destination échoué.");
      return;
    }
    setFlash(
      res.data.ok
        ? `Destination OK — ${res.data.healthStatus}`
        : `Destination indisponible — ${res.data.detail}`,
    );
    await load();
  }

  async function onCancelRestore(id: string) {
    setBusy(true);
    setFlash(null);
    const res = await cancelRestore(id);
    setBusy(false);
    if (!res.data) {
      setFlash(res.message ?? "Annulation échouée.");
      return;
    }
    setFlash("Demande restore annulée.");
    await load();
  }

  async function onStepUpConfirm(result: BackupStepUpResult) {
    if (!stepUp) return;
    setBusy(true);
    setStepUpError(null);
    setFlash(null);

    let message: string | null = null;
    let err: string | null = null;

    if (stepUp.kind === "request") {
      const res = await requestRestore(stepUp.backupId, result.password);
      if (!res.data) err = res.message ?? "Demande restore échouée.";
      else {
        message =
          "Demande restore créée — un second opérateur distinct doit approuver.";
        setTab("restore");
      }
    } else if (stepUp.kind === "approve") {
      const res = await approveRestore(stepUp.restoreId, result.password);
      if (!res.data) err = res.message ?? "Approbation échouée.";
      else
        message =
          "Dry-validé — vous pouvez appliquer (phrase RESTORE) si dump logique.";
    } else if (stepUp.kind === "apply") {
      const res = await applyRestore(
        stepUp.restoreId,
        result.password,
        result.phrase || RESTORE_CONFIRM_PHRASE,
      );
      if (!res.data) err = res.message ?? "Apply restore échoué.";
      else
        message = res.data.applied
          ? "Restore appliqué (logique société)."
          : (res.data.note ?? "Restore traité.");
    }

    setBusy(false);
    if (err) {
      setStepUpError(err);
      return;
    }
    setStepUp(null);
    setFlash(message);
    await load();
  }

  if (state.kind === "loading") {
    return (
      <div className="space-y-3">
        <ASkeleton className="h-24 w-full" />
        <ASkeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.kind === "forbidden") {
    return <AForbiddenState message={state.message} />;
  }

  if (state.kind === "error") {
    return (
      <AErrorState
        message={state.message}
        retryable
        onRetry={() => void load()}
      />
    );
  }

  const {
    dashboard,
    backups,
    restoreRequests,
    jobs,
    destinations,
    policies,
    effective,
  } = state.data;

  const stepUpMeta =
    stepUp?.kind === "request"
      ? {
          title: "Demander un restore",
          description:
            "Impact société — dual-contrôle requis. Mot de passe session obligatoire. Cluster pg_restore bloqué.",
          phrase: undefined as string | undefined,
          label: "Demander",
        }
      : stepUp?.kind === "approve"
        ? {
            title: "Approuver le restore (2ᵉ contrôle)",
            description:
              "Doit être un opérateur différent du demandeur. Lance le dry-validate de l’artefact.",
            phrase: undefined as string | undefined,
            label: "Approuver",
          }
        : stepUp?.kind === "apply"
          ? {
              title: "Appliquer le restore",
              description:
                "Safety backup puis apply logique société uniquement. Tapez RESTORE pour confirmer.",
              phrase: RESTORE_CONFIRM_PHRASE,
              label: "Appliquer",
            }
          : null;

  return (
    <div className="space-y-6">
      {flash ? (
        <p className="rounded-[var(--a-radius-md)] bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg">
          {t(flash)}
        </p>
      ) : null}

      <ATabs
        ariaLabel="Sections backup"
        variant="underline"
        value={tab}
        onValueChange={(id) => setTab(id as TabId)}
        items={[
          { id: "backups", label: "Sauvegardes" },
          { id: "files", label: "Fichiers" },
          ...(foldersTabVisible
            ? [{ id: "folders" as const, label: "Dossiers" }]
            : []),
          { id: "restore", label: "Restauration" },
          { id: "ops", label: "Ops" },
        ]}
      />

      {tab === "files" ? (
        <APageSection
          title={t("Fichiers société")}
          description={t(
            "Naviguer et créer des dossiers métier dans le sandbox — valable pour tout le module (D314).",
          )}
        >
          <div className="space-y-8">
            <BackupCompanyFilesBrowser mode="manage" />
            <BackupLocalDiskPanel />
          </div>
        </APageSection>
      ) : null}

      {tab === "folders" ? (
        <APageSection
          title={t("Dossiers spécifiques")}
          description={t(
            "Archive streaming sous le sandbox société — LOCAL_DISK / DOWNLOAD (D313).",
          )}
        >
          <BackupSpecificFoldersPanel onDone={() => void load()} />
        </APageSection>
      ) : null}

      {tab === "backups" ? (
        <>
          <APageSection title={t("Compteurs")} description={dashboard.note}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(
                [
                  ["total", dashboard.counts.total, "Total"],
                  ["verified", dashboard.counts.verified, "Vérifiées"],
                  ["restorable", dashboard.counts.restorable, "Restaurables"],
                  ["locked", dashboard.counts.locked, "Verrouillées"],
                  ["failed", dashboard.counts.failed, "Échouées"],
                ] as const
              ).map(([key, value, label]) => (
                <div
                  key={key}
                  className="rounded-[var(--a-radius-md)] border border-[color:var(--a-border-subtle)] bg-a-surface-2 px-3 py-3"
                >
                  <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                    {t(label)}
                  </p>
                  <p className="a-mono mt-1 text-[length:var(--a-text-lg)] text-a-fg">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[var(--a-radius-md)] border border-[color:var(--a-border-subtle)] bg-a-surface-2 px-3 py-3">
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  {t("Dernière sauvegarde")}
                </p>
                <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg">
                  {dashboard.lastBackup
                    ? `${dashboard.lastBackup.label ?? dashboard.lastBackup.id.slice(0, 8)} · ${dashboard.lastBackup.scope}`
                    : "—"}
                </p>
              </div>
              <div className="rounded-[var(--a-radius-md)] border border-[color:var(--a-border-subtle)] bg-a-surface-2 px-3 py-3">
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  {t("Dernière vérifiée")}
                </p>
                <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg">
                  {dashboard.lastVerified
                    ? `${dashboard.lastVerified.label ?? dashboard.lastVerified.id.slice(0, 8)}`
                    : "—"}
                </p>
              </div>
              <div className="rounded-[var(--a-radius-md)] border border-[color:var(--a-border-subtle)] bg-a-surface-2 px-3 py-3">
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  {t("Restores ouverts")}
                </p>
                <p className="a-mono mt-1 text-[length:var(--a-text-lg)] text-a-fg">
                  {dashboard.openRestoreRequests ?? 0}
                </p>
              </div>
              <div className="rounded-[var(--a-radius-md)] border border-[color:var(--a-border-subtle)] bg-a-surface-2 px-3 py-3">
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  {t("Planning Tunis")}
                </p>
                <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg">
                  {t("Auto")}{" "}
                  {dashboard.schedule?.autoBackup.enabled
                    ? `H${dashboard.schedule.autoBackup.hourTunis}`
                    : t("off")}
                  {" · "}
                  {t("Rétention")}{" "}
                  {dashboard.schedule?.retention.enabled
                    ? `H${dashboard.schedule.retention.hourTunis}`
                    : t("off")}
                </p>
              </div>
            </div>
          </APageSection>

          <APageSection
            title={t("Nouvelle sauvegarde")}
            description={t(
              "CONFIGURATION = manifeste seulement. DATABASE = dump installable (logical / pg_dump).",
            )}
          >
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-[length:var(--a-text-sm)]">
                <span className="text-a-fg-muted">{t("Portée")}</span>
                <select
                  className={softSelect}
                  value={scope}
                  onChange={(e) =>
                    setScope(e.target.value as "CONFIGURATION" | "DATABASE")
                  }
                  disabled={busy}
                >
                  <option value="CONFIGURATION">CONFIGURATION</option>
                  <option value="DATABASE">DATABASE</option>
                </select>
              </label>
              <AButton
                type="button"
                disabled={busy}
                onClick={() => void onCreate()}
              >
                {t("Créer")}
              </AButton>
              <AButton
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void onRetention()}
              >
                {t("Lancer rétention")}
              </AButton>
              <AButton
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void load()}
              >
                {t("Actualiser")}
              </AButton>
            </div>
          </APageSection>

          <APageSection title={t("Sauvegardes")}>
            {backups.length === 0 ? (
              <AEmptyState
                title={t("Aucune sauvegarde")}
                description={t(
                  "Créez un manifeste ou une sauvegarde DATABASE pour commencer.",
                )}
              />
            ) : (
              <ASoftTable>
                <ASoftThead>
                  <ASoftTr>
                    <ASoftTh>{t("Libellé")}</ASoftTh>
                    <ASoftTh>{t("Portée")}</ASoftTh>
                    <ASoftTh>{t("Statut")}</ASoftTh>
                    <ASoftTh>{t("Taille")}</ASoftTh>
                    <ASoftTh>{t("Restaurable")}</ASoftTh>
                    <ASoftTh>{t("Créée")}</ASoftTh>
                    <ASoftTh>{t("Actions")}</ASoftTh>
                  </ASoftTr>
                </ASoftThead>
                <tbody>
                  {backups.map((row) => (
                    <ASoftTr key={row.id}>
                      <ASoftTd>
                        <span className="font-medium text-a-fg">
                          {row.label ?? row.id.slice(0, 8)}
                        </span>
                      </ASoftTd>
                      <ASoftTd>
                        <span className="a-mono text-[length:var(--a-text-xs)]">
                          {row.scope}
                        </span>
                      </ASoftTd>
                      <ASoftTd>
                        <ABadge tone="neutral">
                          {statusLabel(row.status, locale)}
                        </ABadge>
                      </ASoftTd>
                      <ASoftTd>
                        <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                          {formatBytes(row.sizeBytes)}
                        </span>
                      </ASoftTd>
                      <ASoftTd>
                        <ABadge tone={row.restorable ? "accent" : "neutral"}>
                          {t(row.restorable ? "Oui" : "Non")}
                        </ABadge>
                      </ASoftTd>
                      <ASoftTd>
                        <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                          {new Date(row.createdAt).toLocaleString(
                            locale === "it" ? "it-IT" : "fr-FR",
                          )}
                        </span>
                      </ASoftTd>
                      <ASoftTd>
                        <div className="flex flex-wrap gap-2">
                          <AButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void onOpenDetail(row.id)}
                          >
                            {t("Détail")}
                          </AButton>
                          <AButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void onVerify(row.id)}
                          >
                            {t("Vérifier")}
                          </AButton>
                          <AButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy || row.locked}
                            onClick={() => void onLock(row.id)}
                          >
                            {t("Verrouiller")}
                          </AButton>
                          {row.restorable ? (
                            <AButton
                              type="button"
                              size="sm"
                              variant="danger"
                              disabled={busy}
                              onClick={() => {
                                setStepUpError(null);
                                setStepUp({
                                  kind: "request",
                                  backupId: row.id,
                                });
                              }}
                            >
                              {t("Restore")}
                            </AButton>
                          ) : null}
                          <AButton
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy || row.locked}
                            onClick={() => void onDelete(row.id)}
                          >
                            {t("Supprimer")}
                          </AButton>
                        </div>
                      </ASoftTd>
                    </ASoftTr>
                  ))}
                </tbody>
              </ASoftTable>
            )}
          </APageSection>
        </>
      ) : null}

      {tab === "restore" ? (
        <APageSection
          title={t("Demandes de restore")}
          description={t(
            "1) Demande + mot de passe · 2) Approbation distincte (dry-validate) · 3) Apply + phrase RESTORE. Cluster pg_restore bloqué.",
          )}
        >
          {restoreRequests.length === 0 ? (
            <AEmptyState
              title={t("Aucune demande")}
              description={t(
                "Depuis Sauvegardes, cliquez Restore sur un artefact restorable.",
              )}
            />
          ) : (
            <ASoftTable>
              <ASoftThead>
                <ASoftTr>
                  <ASoftTh>{t("Demande")}</ASoftTh>
                  <ASoftTh>{t("Backup")}</ASoftTh>
                  <ASoftTh>{t("Statut")}</ASoftTh>
                  <ASoftTh>{t("Appliqué")}</ASoftTh>
                  <ASoftTh>{t("Créée")}</ASoftTh>
                  <ASoftTh>{t("Actions")}</ASoftTh>
                </ASoftTr>
              </ASoftThead>
              <tbody>
                {restoreRequests.map((row) => (
                  <ASoftTr key={row.id}>
                    <ASoftTd>
                      <span className="a-mono text-[length:var(--a-text-xs)]">
                        {row.id.slice(0, 8)}
                      </span>
                    </ASoftTd>
                    <ASoftTd>
                      <span className="a-mono text-[length:var(--a-text-xs)]">
                        {row.backupId.slice(0, 8)}
                      </span>
                    </ASoftTd>
                    <ASoftTd>
                      <ABadge
                        tone={
                          row.status === "APPLIED"
                            ? "success"
                            : row.status === "FAILED" ||
                                row.status === "HEALTH_FAILED"
                              ? "danger"
                              : row.status === "DRY_VALIDATED"
                                ? "accent"
                                : "neutral"
                        }
                      >
                        {statusLabel(row.status, locale)}
                      </ABadge>
                    </ASoftTd>
                    <ASoftTd>
                      <ABadge tone={row.applied ? "success" : "neutral"}>
                        {t(row.applied ? "Oui" : "Non")}
                      </ABadge>
                    </ASoftTd>
                    <ASoftTd>
                      <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                        {new Date(row.createdAt).toLocaleString(
                          locale === "it" ? "it-IT" : "fr-FR",
                        )}
                      </span>
                    </ASoftTd>
                    <ASoftTd>
                      <div className="flex flex-wrap gap-2">
                        {row.status === "PENDING_SECOND_APPROVAL" ? (
                          <>
                            <AButton
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                setStepUpError(null);
                                setStepUp({
                                  kind: "approve",
                                  restoreId: row.id,
                                });
                              }}
                            >
                              {t("Approuver")}
                            </AButton>
                            <AButton
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => void onCancelRestore(row.id)}
                            >
                              {t("Annuler")}
                            </AButton>
                          </>
                        ) : null}
                        {row.status === "DRY_VALIDATED" && !row.applied ? (
                          <AButton
                            type="button"
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => {
                              setStepUpError(null);
                              setStepUp({ kind: "apply", restoreId: row.id });
                            }}
                          >
                            {t("Appliquer")}
                          </AButton>
                        ) : null}
                        {row.errorMessage ? (
                          <span className="text-[length:var(--a-text-xs)] text-a-danger">
                            {row.errorMessage}
                          </span>
                        ) : null}
                      </div>
                    </ASoftTd>
                  </ASoftTr>
                ))}
              </tbody>
            </ASoftTable>
          )}
        </APageSection>
      ) : null}

      {tab === "ops" ? (
        <div className="space-y-6">
          <APageSection
            title={t("Préférences effectives")}
            description={t(
              "Valeurs backup.* (DEFAULT ou COMPANY). Modifier dans Préférences → Sauvegarde.",
            )}
            action={
              <AButton type="button" size="sm" variant="secondary" asChild>
                <a href="/settings#backup">{t("Ouvrir Prefs")}</a>
              </AButton>
            }
          >
            {effective.length === 0 ? (
              <AEmptyState title={t("Aucune préférence")} />
            ) : (
              <ASoftTable>
                <ASoftThead>
                  <ASoftTr>
                    <ASoftTh>{t("Clé")}</ASoftTh>
                    <ASoftTh>{t("Valeur")}</ASoftTh>
                    <ASoftTh>{t("Source")}</ASoftTh>
                  </ASoftTr>
                </ASoftThead>
                <tbody>
                  {effective.map((row) => (
                    <ASoftTr key={row.key}>
                      <ASoftTd>
                        <span className="a-mono text-[length:var(--a-text-xs)]">
                          {row.key}
                        </span>
                      </ASoftTd>
                      <ASoftTd>
                        <span className="a-mono text-[length:var(--a-text-xs)]">
                          {typeof row.value === "string"
                            ? row.value || "—"
                            : JSON.stringify(row.value)}
                        </span>
                      </ASoftTd>
                      <ASoftTd>
                        <ABadge
                          tone={row.source === "COMPANY" ? "accent" : "neutral"}
                        >
                          {row.source}
                        </ABadge>
                      </ASoftTd>
                    </ASoftTr>
                  ))}
                </tbody>
              </ASoftTable>
            )}
          </APageSection>

          <APageSection title={t("Jobs")}>
            {jobs.length === 0 ? (
              <AEmptyState
                title={t("Aucun job")}
                description={t("Les jobs retention / backup apparaîtront ici.")}
              />
            ) : (
              <ASoftTable>
                <ASoftThead>
                  <ASoftTr>
                    <ASoftTh>{t("Type")}</ASoftTh>
                    <ASoftTh>{t("Statut")}</ASoftTh>
                    <ASoftTh>{t("Créée")}</ASoftTh>
                  </ASoftTr>
                </ASoftThead>
                <tbody>
                  {jobs.map((job) => (
                    <ASoftTr key={job.id}>
                      <ASoftTd>
                        <span className="a-mono text-[length:var(--a-text-xs)]">
                          {job.type}
                        </span>
                      </ASoftTd>
                      <ASoftTd>
                        <ABadge tone="neutral">
                          {statusLabel(job.status, locale)}
                        </ABadge>
                      </ASoftTd>
                      <ASoftTd>
                        <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                          {new Date(job.createdAt).toLocaleString(
                            locale === "it" ? "it-IT" : "fr-FR",
                          )}
                        </span>
                      </ASoftTd>
                    </ASoftTr>
                  ))}
                </tbody>
              </ASoftTable>
            )}
          </APageSection>

          <APageSection title={t("Destinations")}>
            {destinations.length === 0 ? (
              <AEmptyState title={t("Aucune destination")} />
            ) : (
              <ASoftTable>
                <ASoftThead>
                  <ASoftTr>
                    <ASoftTh>{t("Nom")}</ASoftTh>
                    <ASoftTh>{t("Type")}</ASoftTh>
                    <ASoftTh>{t("Santé")}</ASoftTh>
                    <ASoftTh>{t("Chemin")}</ASoftTh>
                    <ASoftTh>{t("Actions")}</ASoftTh>
                  </ASoftTr>
                </ASoftThead>
                <tbody>
                  {destinations.map((d) => (
                    <ASoftTr key={d.id}>
                      <ASoftTd>{d.name}</ASoftTd>
                      <ASoftTd>
                        <span className="a-mono text-[length:var(--a-text-xs)]">
                          {d.type}
                        </span>
                      </ASoftTd>
                      <ASoftTd>
                        <ABadge tone="neutral">{d.healthStatus}</ABadge>
                      </ASoftTd>
                      <ASoftTd>
                        <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                          {d.pathRef}
                        </span>
                      </ASoftTd>
                      <ASoftTd>
                        <AButton
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => void onTestDestination(d.id)}
                        >
                          {t("Tester")}
                        </AButton>
                      </ASoftTd>
                    </ASoftTr>
                  ))}
                </tbody>
              </ASoftTable>
            )}
          </APageSection>

          <APageSection title={t("Politiques")}>
            {policies.length === 0 ? (
              <AEmptyState title={t("Aucune politique")} />
            ) : (
              <ASoftTable>
                <ASoftThead>
                  <ASoftTr>
                    <ASoftTh>{t("Nom")}</ASoftTh>
                    <ASoftTh>{t("Portée")}</ASoftTh>
                    <ASoftTh>{t("Planning")}</ASoftTh>
                    <ASoftTh>{t("Vérif.")}</ASoftTh>
                  </ASoftTr>
                </ASoftThead>
                <tbody>
                  {policies.map((p) => (
                    <ASoftTr key={p.id}>
                      <ASoftTd>{p.name}</ASoftTd>
                      <ASoftTd>
                        <span className="a-mono text-[length:var(--a-text-xs)]">
                          {p.scope}
                        </span>
                      </ASoftTd>
                      <ASoftTd>
                        {p.scheduleEnabled
                          ? (p.scheduleCron ?? t("Activé"))
                          : t("Désactivé")}
                      </ASoftTd>
                      <ASoftTd>
                        {t(p.verificationRequired ? "Oui" : "Non")}
                      </ASoftTd>
                    </ASoftTr>
                  ))}
                </tbody>
              </ASoftTable>
            )}
          </APageSection>
        </div>
      ) : null}

      <BackupStepUpDialog
        open={Boolean(stepUp && stepUpMeta)}
        title={stepUpMeta?.title ?? ""}
        description={stepUpMeta?.description ?? ""}
        confirmPhrase={stepUpMeta?.phrase}
        confirmLabel={stepUpMeta?.label}
        busy={busy}
        error={stepUpError}
        onCancel={() => {
          if (!busy) {
            setStepUp(null);
            setStepUpError(null);
          }
        }}
        onConfirm={onStepUpConfirm}
      />

      <ADrawer
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setDetail(null);
        }}
        title={detail?.label ?? t("Détail sauvegarde")}
        description={detail ? `${detail.scope} · ${detail.status}` : undefined}
      >
        {detail ? (
          <dl className="space-y-3 text-[length:var(--a-text-sm)]">
            <div>
              <dt className="text-a-fg-muted">{t("ID")}</dt>
              <dd className="a-mono text-a-fg">{detail.id}</dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">{t("Checksum")}</dt>
              <dd className="a-mono break-all text-a-fg">
                {detail.checksumSha256 ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">{t("Artefact")}</dt>
              <dd className="a-mono break-all text-a-fg">
                {detail.artifactPath ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">{t("Taille")}</dt>
              <dd className="a-mono text-a-fg">
                {formatBytes(detail.sizeBytes)}
              </dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">{t("Restaurable")}</dt>
              <dd>{t(detail.restorable ? "Oui" : "Non")}</dd>
            </div>
            {detail.manifest ? (
              <div>
                <dt className="text-a-fg-muted">{t("Manifeste")}</dt>
                <dd className="a-mono text-a-fg">
                  {detail.manifest.schemaVersion} ·{" "}
                  {detail.manifest.applicationVersion} ·{" "}
                  {detail.manifest.checksumAlgorithm}
                </dd>
              </div>
            ) : null}
            {detail.errorMessage ? (
              <div>
                <dt className="text-a-fg-muted">{t("Erreur")}</dt>
                <dd className="text-a-danger">{detail.errorMessage}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </ADrawer>
    </div>
  );
}
