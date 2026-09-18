"use client";

import { useCallback, useEffect, useState } from "react";
import { AButton, AErrorState, ASkeleton } from "@/components/a";
import { PrefsToggleRow } from "@/components/settings/prefs-toggle-row";
import { softPanel, softSelect } from "@/lib/d294-ui";
import { useUiT } from "@/lib/i18n/route-labels";
import {
  fetchEffectiveSettings,
  putCompanySetting,
} from "@/lib/settings";

type BackupPrefsState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ok";
      retentionEnabled: boolean;
      keepDays: string;
      lockedNeverDelete: boolean;
      scheduleEnabled: boolean;
      scheduleHour: string;
      safetyRequired: boolean;
      autoEnabled: boolean;
      autoHour: string;
      autoScope: "CONFIGURATION" | "DATABASE";
      preAction: boolean;
      specificEnabled: boolean;
      specificAllowUser: boolean;
      specificVerify: boolean;
      specificAutoEnabled: boolean;
      specificAutoHour: string;
      allowDownload: boolean;
      allowLocalDisk: boolean;
      localSubpath: string;
    };

function boolFrom(settings: Array<{ key: string; value: unknown }>, key: string, fallback: boolean) {
  const row = settings.find((s) => s.key === key);
  if (!row) return fallback;
  return row.value === true;
}

function numFrom(settings: Array<{ key: string; value: unknown }>, key: string, fallback: string) {
  const row = settings.find((s) => s.key === key);
  if (row == null) return fallback;
  if (typeof row.value === "number") return String(row.value);
  if (typeof row.value === "string") return row.value;
  return fallback;
}

function strFrom(
  settings: Array<{ key: string; value: unknown }>,
  key: string,
  fallback: string,
) {
  const row = settings.find((s) => s.key === key);
  if (row == null) return fallback;
  if (typeof row.value === "string") return row.value;
  return fallback;
}

function scopeFrom(
  settings: Array<{ key: string; value: unknown }>,
): "CONFIGURATION" | "DATABASE" {
  const row = settings.find((s) => s.key === "backup.autoBackup.scope");
  return row?.value === "CONFIGURATION" ? "CONFIGURATION" : "DATABASE";
}

/** Prefs compartment — Backup & Recovery company settings (D308). */
export function PrefsBackupPanel() {
  const { t } = useUiT();
  const [state, setState] = useState<BackupPrefsState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await fetchEffectiveSettings();
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    const s = res.data.settings;
    setState({
      kind: "ok",
      retentionEnabled: boolFrom(s, "backup.retention.enabled", false),
      keepDays: numFrom(s, "backup.retention.keepDays", "30"),
      lockedNeverDelete: boolFrom(s, "backup.retention.lockedNeverDelete", true),
      scheduleEnabled: boolFrom(s, "backup.schedule.enabled", false),
      scheduleHour: numFrom(s, "backup.schedule.hourTunis", "3"),
      safetyRequired: boolFrom(s, "backup.restore.safetyBackup.required", true),
      autoEnabled: boolFrom(s, "backup.autoBackup.enabled", false),
      autoHour: numFrom(s, "backup.autoBackup.hourTunis", "2"),
      autoScope: scopeFrom(s),
      preAction: boolFrom(s, "backup.preActionSnapshot.enabled", true),
      specificEnabled: boolFrom(s, "backup.specificFolders.enabled", false),
      specificAllowUser: boolFrom(
        s,
        "backup.specificFolders.allowUserSelection",
        true,
      ),
      specificVerify: boolFrom(
        s,
        "backup.specificFolders.verifyAfterBackup",
        true,
      ),
      specificAutoEnabled: boolFrom(
        s,
        "backup.specificFolders.auto.enabled",
        false,
      ),
      specificAutoHour: numFrom(s, "backup.specificFolders.auto.hourTunis", "23"),
      allowDownload: boolFrom(s, "backup.destination.allowDownload", true),
      allowLocalDisk: boolFrom(s, "backup.destination.allowLocalDisk", true),
      localSubpath: strFrom(s, "backup.destination.localSubpath", ""),
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function put(
    key: string,
    value: unknown,
    patch: (prev: Extract<BackupPrefsState, { kind: "ok" }>) => Partial<
      Extract<BackupPrefsState, { kind: "ok" }>
    >,
  ) {
    if (state.kind !== "ok") return;
    setBusy(true);
    setMsg(null);
    const res = await putCompanySetting(key, value);
    setBusy(false);
    if (!res.ok) {
      setMsg(res.message);
      return;
    }
    setState({ ...state, ...patch(state) });
    setMsg("Préférence Backup enregistrée.");
  }

  if (state.kind === "loading") {
    return <ASkeleton className="h-48 w-full max-w-xl" />;
  }
  if (state.kind === "error") {
    return (
      <AErrorState message={state.message} retryable onRetry={() => void load()} />
    );
  }

  return (
    <section className={`${softPanel} max-w-xl space-y-6`}>
      <div>
        <h2 className="text-[length:var(--a-text-md)] font-medium text-a-accent">
          {t("Backup & Recovery")}
        </h2>
        <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
          {t(
            "Rétention, planning Tunis, auto, dossiers, destination LOCAL_DISK — Prefs société (D306–D314).",
          )}
        </p>
      </div>

      {msg ? (
        <p className="rounded-[var(--a-radius-md)] bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg">
          {t(msg)}
        </p>
      ) : null}

      <div className="space-y-1">
        <h3 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
          {t("Sauvegarde automatique")}
        </h3>
        <PrefsToggleRow
          title={t("Activer auto-backup")}
          description={t(
            "Crée une sauvegarde quotidienne à l’heure Tunis (scope configurable).",
          )}
          checked={state.autoEnabled}
          disabled={busy}
          onCheckedChange={(on) =>
            void put("backup.autoBackup.enabled", on, () => ({
              autoEnabled: on,
            }))
          }
        />
        <label className="flex flex-col gap-1 py-2 text-[length:var(--a-text-sm)]">
          <span className="text-a-fg-muted">{t("Heure Tunis (auto)")}</span>
          <input
            type="number"
            min={0}
            max={23}
            className={softSelect}
            value={state.autoHour}
            disabled={busy}
            onChange={(e) =>
              setState({ ...state, autoHour: e.target.value })
            }
            onBlur={() => {
              const n = Number(state.autoHour);
              if (!Number.isInteger(n) || n < 0 || n > 23) return;
              void put("backup.autoBackup.hourTunis", n, () => ({
                autoHour: String(n),
              }));
            }}
          />
        </label>
        <label className="flex flex-col gap-1 py-2 text-[length:var(--a-text-sm)]">
          <span className="text-a-fg-muted">{t("Portée auto")}</span>
          <select
            className={softSelect}
            value={state.autoScope}
            disabled={busy}
            onChange={(e) => {
              const scope = e.target.value as "CONFIGURATION" | "DATABASE";
              void put("backup.autoBackup.scope", scope, () => ({
                autoScope: scope,
              }));
            }}
          >
            <option value="DATABASE">DATABASE</option>
            <option value="CONFIGURATION">CONFIGURATION</option>
          </select>
        </label>
      </div>

      <div className="space-y-1">
        <h3 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
          {t("Rétention")}
        </h3>
        <PrefsToggleRow
          title={t("Activer rétention")}
          description={t("Soft-delete des sauvegardes hors fenêtre keepDays.")}
          checked={state.retentionEnabled}
          disabled={busy}
          onCheckedChange={(on) =>
            void put("backup.retention.enabled", on, () => ({
              retentionEnabled: on,
            }))
          }
        />
        <PrefsToggleRow
          title={t("Ne jamais purger les verrouillées")}
          checked={state.lockedNeverDelete}
          disabled={busy}
          onCheckedChange={(on) =>
            void put("backup.retention.lockedNeverDelete", on, () => ({
              lockedNeverDelete: on,
            }))
          }
        />
        <label className="flex flex-col gap-1 py-2 text-[length:var(--a-text-sm)]">
          <span className="text-a-fg-muted">{t("Jours de conservation")}</span>
          <input
            type="number"
            min={1}
            max={3650}
            className={softSelect}
            value={state.keepDays}
            disabled={busy}
            onChange={(e) =>
              setState({ ...state, keepDays: e.target.value })
            }
            onBlur={() => {
              const n = Number(state.keepDays);
              if (!Number.isInteger(n) || n < 1 || n > 3650) return;
              void put("backup.retention.keepDays", n, () => ({
                keepDays: String(n),
              }));
            }}
          />
        </label>
        <PrefsToggleRow
          title={t("Planning rétention Tunis")}
          description={t(
            "Enqueue Thunder retention à l’heure Tunis (backup.schedule.*).",
          )}
          checked={state.scheduleEnabled}
          disabled={busy}
          onCheckedChange={(on) =>
            void put("backup.schedule.enabled", on, () => ({
              scheduleEnabled: on,
            }))
          }
        />
        <label className="flex flex-col gap-1 py-2 text-[length:var(--a-text-sm)]">
          <span className="text-a-fg-muted">{t("Heure Tunis (rétention)")}</span>
          <input
            type="number"
            min={0}
            max={23}
            className={softSelect}
            value={state.scheduleHour}
            disabled={busy}
            onChange={(e) =>
              setState({ ...state, scheduleHour: e.target.value })
            }
            onBlur={() => {
              const n = Number(state.scheduleHour);
              if (!Number.isInteger(n) || n < 0 || n > 23) return;
              void put("backup.schedule.hourTunis", n, () => ({
                scheduleHour: String(n),
              }));
            }}
          />
        </label>
      </div>

      <div className="space-y-1">
        <h3 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
          {t("Dossiers spécifiques")}
        </h3>
        <PrefsToggleRow
          title={t("Activer la sauvegarde de dossiers spécifiques")}
          description={t(
            "Archive streaming du sandbox société (data/company-files/…). NAS/cloud/chiffrement = Non supporté.",
          )}
          checked={state.specificEnabled}
          disabled={busy}
          onCheckedChange={(on) =>
            void put("backup.specificFolders.enabled", on, () => ({
              specificEnabled: on,
            }))
          }
        />
        <PrefsToggleRow
          title={t("Autoriser la sélection utilisateur")}
          checked={state.specificAllowUser}
          disabled={busy || !state.specificEnabled}
          onCheckedChange={(on) =>
            void put("backup.specificFolders.allowUserSelection", on, () => ({
              specificAllowUser: on,
            }))
          }
        />
        <PrefsToggleRow
          title={t("Vérifier après sauvegarde")}
          checked={state.specificVerify}
          disabled={busy || !state.specificEnabled}
          onCheckedChange={(on) =>
            void put("backup.specificFolders.verifyAfterBackup", on, () => ({
              specificVerify: on,
            }))
          }
        />
        <PrefsToggleRow
          title={t("Auto dossiers (Tunis)")}
          description={t(
            "Enqueue à l’heure Tunis avec defaultSelection Prefs.",
          )}
          checked={state.specificAutoEnabled}
          disabled={busy || !state.specificEnabled}
          onCheckedChange={(on) =>
            void put("backup.specificFolders.auto.enabled", on, () => ({
              specificAutoEnabled: on,
            }))
          }
        />
        <label className="flex flex-col gap-1 py-2 text-[length:var(--a-text-sm)]">
          <span className="text-a-fg-muted">{t("Heure Tunis (dossiers)")}</span>
          <input
            type="number"
            min={0}
            max={23}
            className={softSelect}
            value={state.specificAutoHour}
            disabled={busy || !state.specificEnabled}
            onChange={(e) =>
              setState({ ...state, specificAutoHour: e.target.value })
            }
            onBlur={() => {
              const n = Number(state.specificAutoHour);
              if (!Number.isInteger(n) || n < 0 || n > 23) return;
              void put("backup.specificFolders.auto.hourTunis", n, () => ({
                specificAutoHour: String(n),
              }));
            }}
          />
        </label>
      </div>

      <div className="space-y-1">
        <h3 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
          {t("Destination LOCAL_DISK")}
        </h3>
        <PrefsToggleRow
          title={t("Autoriser LOCAL_DISK")}
          checked={state.allowLocalDisk}
          disabled={busy}
          onCheckedChange={(on) =>
            void put("backup.destination.allowLocalDisk", on, () => ({
              allowLocalDisk: on,
            }))
          }
        />
        <PrefsToggleRow
          title={t("Autoriser téléchargement métier")}
          description={t(
            "DOWNLOAD des archives dossiers (compta, finance…) — pas les dumps système.",
          )}
          checked={state.allowDownload}
          disabled={busy}
          onCheckedChange={(on) =>
            void put("backup.destination.allowDownload", on, () => ({
              allowDownload: on,
            }))
          }
        />
        <label className="flex flex-col gap-1 py-2 text-[length:var(--a-text-sm)]">
          <span className="text-a-fg-muted">
            {t("Sous-chemin LOCAL_DISK (relatif)")}
          </span>
          <input
            className={softSelect}
            value={state.localSubpath}
            disabled={busy}
            placeholder={t("ex. archives/2026")}
            onChange={(e) =>
              setState({ ...state, localSubpath: e.target.value })
            }
            onBlur={() => {
              void put(
                "backup.destination.localSubpath",
                state.localSubpath.trim(),
                () => ({ localSubpath: state.localSubpath.trim() }),
              );
            }}
          />
          <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
            {t("Sous data/backups/{companyId}/ — pas de chemins absolus ni ..")}
          </span>
        </label>
        <AButton
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            window.location.href = "/backup#files";
          }}
        >
          {t("Ouvrir Fichiers société")}
        </AButton>
      </div>

      <div className="space-y-1">
        <h3 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
          {t("Sécurité restore")}
        </h3>
        <PrefsToggleRow
          title={t("Safety backup avant apply")}
          description={t(
            "Crée un dump DATABASE avant apply restore (D307).",
          )}
          checked={state.safetyRequired}
          disabled={busy}
          onCheckedChange={(on) =>
            void put("backup.restore.safetyBackup.required", on, () => ({
              safetyRequired: on,
            }))
          }
        />
        <PrefsToggleRow
          title={t("Snapshot pré-action Repair")}
          description={t(
            "Repair peut demander une sauvegarde avant action.",
          )}
          checked={state.preAction}
          disabled={busy}
          onCheckedChange={(on) =>
            void put("backup.preActionSnapshot.enabled", on, () => ({
              preAction: on,
            }))
          }
        />
      </div>

      <AButton
        type="button"
        variant="secondary"
        disabled={busy}
        onClick={() => void load()}
      >
        {t("Actualiser")}
      </AButton>
    </section>
  );
}
