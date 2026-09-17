"use client";

import { PrefsToggleRow } from "@/components/settings/prefs-toggle-row";
import { AButton } from "@/components/a";
import { previewAuthorityNotifSound } from "@/lib/authority-notif-audio";
import {
  NOTIF_SOURCE_KEYS,
  NOTIF_SOURCE_META,
  type NotifSoundVariant,
} from "@/lib/notification-prefs";
import { useLocaleStore } from "@/stores/locale-store";
import { usePrefsStore } from "@/stores/prefs-store";

type Props = {
  /** Compact mode for drawer (no outer heading). */
  compact?: boolean;
};

/**
 * Notification prefs (D249/D294) — mute per source + AUTHORITY audio.
 */
export function NotifPrefsPanel({ compact }: Props) {
  const locale = useLocaleStore((s) => s.locale);
  const it = locale === "it";
  const notifMuted = usePrefsStore((s) => s.notifMuted);
  const setNotifMuted = usePrefsStore((s) => s.setNotifMuted);
  const setNotifMutedAll = usePrefsStore((s) => s.setNotifMutedAll);
  const notifSoundEnabled = usePrefsStore((s) => s.notifSoundEnabled);
  const setNotifSoundEnabled = usePrefsStore((s) => s.setNotifSoundEnabled);
  const notifSoundVolume = usePrefsStore((s) => s.notifSoundVolume);
  const setNotifSoundVolume = usePrefsStore((s) => s.setNotifSoundVolume);
  const notifSoundVariant = usePrefsStore((s) => s.notifSoundVariant);
  const setNotifSoundVariant = usePrefsStore((s) => s.setNotifSoundVariant);
  const notifAnimEnabled = usePrefsStore((s) => s.notifAnimEnabled);
  const setNotifAnimEnabled = usePrefsStore((s) => s.setNotifAnimEnabled);
  const jobAlerts = usePrefsStore((s) => s.jobAlerts);
  const setJobAlerts = usePrefsStore((s) => s.setJobAlerts);
  const showSseBanner = usePrefsStore((s) => s.showSseBanner);
  const setShowSseBanner = usePrefsStore((s) => s.setShowSseBanner);

  const mutedCount = NOTIF_SOURCE_KEYS.filter((k) => notifMuted[k]).length;

  return (
    <div className="space-y-4">
      {!compact ? (
        <div>
          <h2 className="text-[length:var(--a-text-md)] font-medium text-a-fg">
            {it ? "Centro notifiche" : "Centre de notifications"}
          </h2>
          <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
            {it
              ? "Mute per sorgente, audio AUTHORITY, animazioni. Preferenze postazione (local)."
              : "Mute par source, audio AUTHORITY, animations. Préférences poste (local)."}
          </p>
        </div>
      ) : null}

      <PrefsToggleRow
        title={it ? "Audio AUTHORITY" : "Audio AUTHORITY"}
        description={
          it
            ? "Tono procedurale AUTHORITY (nessun asset binario)."
            : "Tonalité procédurale AUTHORITY (aucun fichier binaire)."
        }
        checked={notifSoundEnabled}
        onCheckedChange={setNotifSoundEnabled}
      />

      {notifSoundEnabled ? (
        <div className="space-y-3 a-underlay rounded-[var(--a-radius-md)] px-3 py-3">
          <label className="block space-y-1">
            <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              {it ? "Volume" : "Volume"} · {Math.round(notifSoundVolume * 100)} %
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(notifSoundVolume * 100)}
              onChange={(e) =>
                setNotifSoundVolume(Number(e.target.value) / 100)
              }
              className="w-full accent-[var(--a-accent)]"
            />
          </label>
          <div>
            <p className="mb-1.5 text-[length:var(--a-text-xs)] text-a-fg-muted">
              {it ? "Variante" : "Variante"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["soft", it ? "Soft" : "Doux"],
                  ["pulse", it ? "Pulse" : "Pulse"],
                  ["chime", it ? "Chime" : "Carillon"],
                ] as const
              ).map(([id, label]) => (
                <AButton
                  key={id}
                  type="button"
                  size="sm"
                  variant={notifSoundVariant === id ? "primary" : "ghost"}
                  onClick={() =>
                    setNotifSoundVariant(id as NotifSoundVariant)
                  }
                >
                  {label}
                </AButton>
              ))}
            </div>
          </div>
          <AButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              previewAuthorityNotifSound(notifSoundVolume, notifSoundVariant)
            }
          >
            {it ? "Prova tono" : "Tester le ton"}
          </AButton>
        </div>
      ) : null}

      <PrefsToggleRow
        title={it ? "Animazioni alert" : "Animations alertes"}
        description={
          it
            ? "Entrata minimale (rispetta reduced-motion)."
            : "Entrée minimale (respecte reduced-motion)."
        }
        checked={notifAnimEnabled}
        onCheckedChange={setNotifAnimEnabled}
      />

      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
            {it ? "Mute per sorgente" : "Mute par source"}
          </p>
          <div className="flex gap-1">
            <AButton
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setNotifMutedAll(false)}
            >
              {it ? "Smuta tutto" : "Tout activer"}
            </AButton>
            <AButton
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setNotifMutedAll(true)}
            >
              {it ? "Muta tutto" : "Tout muter"}
            </AButton>
          </div>
        </div>
        <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
          {it
            ? `${mutedCount} mutati — nascosti dalla cloche e senza audio.`
            : `${mutedCount} muté(s) — masqués de la cloche et sans audio.`}
        </p>
        <div className="mt-2 space-y-1">
          {NOTIF_SOURCE_KEYS.map((key) => {
            const meta = NOTIF_SOURCE_META[key];
            return (
              <PrefsToggleRow
                key={key}
                title={it ? meta.it : meta.fr}
                description={it ? meta.hintIt : meta.hintFr}
                checked={!notifMuted[key]}
                onCheckedChange={(on) => setNotifMuted(key, !on)}
              />
            );
          })}
        </div>
      </div>

      {!compact ? (
        <>
          <PrefsToggleRow
            title={it ? "Avvisi jobs" : "Alertes jobs"}
            description={
              it
                ? "Mostra shed P4 / code Thunder nel centro."
                : "Afficher shed P4 / files Thunder dans le centre."
            }
            checked={jobAlerts}
            onCheckedChange={setJobAlerts}
          />
          <PrefsToggleRow
            title={it ? "Banner SSE" : "Bannière SSE"}
            description={
              it
                ? "Mostra « flusso tempo reale interrotto »."
                : "Afficher « flux temps réel coupé »."
            }
            checked={showSseBanner}
            onCheckedChange={setShowSseBanner}
          />
        </>
      ) : null}
    </div>
  );
}
