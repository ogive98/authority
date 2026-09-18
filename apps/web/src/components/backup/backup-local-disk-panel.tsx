"use client";

import { useCallback, useEffect, useState } from "react";
import { AButton, ASkeleton } from "@/components/a";
import { fetchLocalDiskResolve, mkdirLocalDisk } from "@/lib/backup-api";
import { softSelect } from "@/lib/d294-ui";
import { useUiT } from "@/lib/i18n/route-labels";

/** D314 — LOCAL_DISK path resolve + mkdir under Prefs localSubpath. */
export function BackupLocalDiskPanel() {
  const { t } = useUiT();
  const [fromCwd, setFromCwd] = useState<string | null>(null);
  const [localSubpath, setLocalSubpath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchLocalDiskResolve();
    setLoading(false);
    if (!res.data) {
      setError(res.message ?? "LOCAL_DISK indisponible");
      return;
    }
    setFromCwd(res.data.fromCwd);
    setLocalSubpath(res.data.localSubpath);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate() {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setFlash(null);
    const res = await mkdirLocalDisk({ name: n });
    setBusy(false);
    if (!res.data) {
      setFlash(res.message ?? t("Création dossier LOCAL_DISK échouée."));
      return;
    }
    setFlash(t("Dossier LOCAL_DISK créé."));
    setName("");
    await load();
  }

  if (loading && !fromCwd && !error) {
    return <ASkeleton lines={3} />;
  }

  return (
    <section className="space-y-3 border-t border-[color:var(--a-border-subtle)] pt-6">
      <h3 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
        {t("Disque local (artefacts)")}
      </h3>
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        {t(
          "Sous-chemin Prefs backup.destination.localSubpath — création de dossiers sous data/backups/{companyId}/.",
        )}
      </p>
      {error ? (
        <p className="text-[length:var(--a-text-sm)] text-a-danger">{t(error)}</p>
      ) : (
        <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg">
          {fromCwd}
          {localSubpath ? ` · subpath=${localSubpath}` : ""}
        </p>
      )}
      {flash ? (
        <p className="text-[length:var(--a-text-sm)] text-a-fg">{t(flash)}</p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[length:var(--a-text-sm)]">
          <span className="text-a-fg-muted">{t("Nouveau sous-dossier")}</span>
          <input
            className={softSelect}
            value={name}
            disabled={busy || Boolean(error)}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <AButton
          type="button"
          variant="secondary"
          disabled={busy || !name.trim() || Boolean(error)}
          onClick={() => void onCreate()}
        >
          {t("Créer sur LOCAL_DISK")}
        </AButton>
        <AButton
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            window.location.href = "/settings#backup";
          }}
        >
          {t("Paramétrer le sous-chemin")}
        </AButton>
      </div>
    </section>
  );
}
