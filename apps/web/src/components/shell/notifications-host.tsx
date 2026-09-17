"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AActivityCenter, AOfflineBanner } from "@/components/a";
import { playAuthorityNotifSound } from "@/lib/authority-notif-audio";
import { isShellLight } from "@/lib/dev-light";
import { isJobAlert, isP0 } from "@/lib/notifications";
import { isNotifSourceKey } from "@/lib/notification-prefs";
import { useNotificationsStore } from "@/stores/notifications-store";
import { usePrefsStore } from "@/stores/prefs-store";

const POLL_MS = 60_000;

/**
 * Notifications host (D247–D249) — API sync, mute filter, AUTHORITY audio, enter anim.
 */
export function NotificationsHost() {
  const items = useNotificationsStore((s) => s.items);
  const sseStatus = useNotificationsStore((s) => s.sseStatus);
  const inboxOpen = useNotificationsStore((s) => s.inboxOpen);
  const setInboxOpen = useNotificationsStore((s) => s.setInboxOpen);
  const markItemRead = useNotificationsStore((s) => s.markItemRead);
  const markAllItemsRead = useNotificationsStore((s) => s.markAllItemsRead);
  const hydrateFromApi = useNotificationsStore((s) => s.hydrateFromApi);
  const loading = useNotificationsStore((s) => s.loading);
  const showSseBanner = usePrefsStore((s) => s.showSseBanner);
  const jobAlerts = usePrefsStore((s) => s.jobAlerts);
  const notifMuted = usePrefsStore((s) => s.notifMuted);
  const notifSoundEnabled = usePrefsStore((s) => s.notifSoundEnabled);
  const notifSoundVolume = usePrefsStore((s) => s.notifSoundVolume);
  const notifSoundVariant = usePrefsStore((s) => s.notifSoundVariant);

  const knownIdsRef = useRef<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [bellPulse, setBellPulse] = useState(false);

  useEffect(() => {
    void hydrateFromApi();
    if (isShellLight()) return;
    const t = window.setInterval(() => {
      void hydrateFromApi();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [hydrateFromApi]);

  useEffect(() => {
    const unread = items.filter((n) => !n.read);
    if (knownIdsRef.current == null) {
      knownIdsRef.current = new Set(items.map((n) => n.id));
      return;
    }
    const known = knownIdsRef.current;
    const newcomers = unread.filter((n) => !known.has(n.id));
    for (const n of items) known.add(n.id);

    if (newcomers.length === 0) return;

    const audible = newcomers.filter((n) => {
      if (!isNotifSourceKey(n.source)) return true;
      return !notifMuted[n.source];
    });

    setFreshIds(new Set(newcomers.map((n) => n.id)));
    const clear = window.setTimeout(() => setFreshIds(new Set()), 2400);

    if (audible.length > 0) {
      setBellPulse(true);
      const clearBell = window.setTimeout(() => setBellPulse(false), 3200);
      if (notifSoundEnabled) {
        const critical = audible.some((n) => isP0(n));
        void playAuthorityNotifSound({
          variant: notifSoundVariant,
          volume: notifSoundVolume,
          critical,
        });
      }
      return () => {
        window.clearTimeout(clear);
        window.clearTimeout(clearBell);
      };
    }
    return () => window.clearTimeout(clear);
  }, [
    items,
    notifMuted,
    notifSoundEnabled,
    notifSoundVolume,
    notifSoundVariant,
  ]);

  /** Expose bell pulse for header via custom event. */
  useEffect(() => {
    if (!bellPulse) return;
    window.dispatchEvent(new CustomEvent("authority:notif-bell-pulse"));
  }, [bellPulse]);

  const visibleItems = useMemo(() => {
    let list = jobAlerts ? items : items.filter((n) => !isJobAlert(n));
    list = list.filter((n) => {
      if (!isNotifSourceKey(n.source)) return true;
      return !notifMuted[n.source];
    });
    return list;
  }, [items, jobAlerts, notifMuted]);

  const sseLost =
    showSseBanner && !isShellLight() && sseStatus === "disconnected";

  return (
    <>
      {sseLost ? (
        <div className="pointer-events-none fixed top-12 inset-x-0 z-[var(--a-z-toast)] flex justify-center px-3 pt-2 md:px-4">
          <div className="pointer-events-auto w-fit max-w-3xl">
            <AOfflineBanner sseLost />
          </div>
        </div>
      ) : null}
      <AActivityCenter
        open={inboxOpen}
        onOpenChange={setInboxOpen}
        items={visibleItems}
        onMarkRead={markItemRead}
        onMarkAllRead={markAllItemsRead}
        onRefresh={() => void hydrateFromApi()}
        refreshing={loading}
        freshIds={freshIds}
      />
    </>
  );
}
