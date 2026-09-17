"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchThunderCcLayout,
  saveThunderCcLayout,
  type ThunderCcLayoutDto,
} from "@/lib/thunder/cc-layout-api";
import type { ThunderAlertThresholds } from "@/lib/thunder/alert-thresholds";
import { useThunderDashboardStore } from "@/stores/thunder-dashboard-store";
import { AButton } from "@/components/a";

const SAVE_DEBOUNCE_MS = 2_500;

/**
 * Hydrate Thunder CC layout from server (USER set_value), keep localStorage
 * as offline cache, debounce cloud save after local edits.
 */
export function ThunderCcLayoutSync({
  className,
}: {
  className?: string;
}) {
  const widgets = useThunderDashboardStore((s) => s.widgets);
  const compact = useThunderDashboardStore((s) => s.compact);
  const thresholds = useThunderDashboardStore((s) => s.thresholds);
  const applyServerLayout = useThunderDashboardStore((s) => s.applyServerLayout);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "ok" | "err">(
    "loading",
  );
  const [hint, setHint] = useState<string | null>(null);
  const hydrated = useRef(false);
  const skipNextSave = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setStatus("loading");
      const remote = await fetchThunderCcLayout();
      if (cancelled) return;
      if (remote?.widgets?.length) {
        applyServerLayout({
          widgets: remote.widgets.map((w) => ({
            id: w.id,
            widgetDefinitionId: w.widgetDefinitionId,
            dashboardId: "thunder.command-center",
            position: w.position,
            configuration: {},
            visibility: w.visibility,
            order: w.order,
          })),
          compact: remote.compact,
          thresholds: remote.thresholds as Partial<ThunderAlertThresholds> | undefined,
        });
        setHint(remote.updatedAt ? `cloud ${remote.updatedAt.slice(11, 19)}` : "cloud");
        skipNextSave.current = true;
      } else {
        setHint("local");
      }
      hydrated.current = true;
      setStatus("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, [applyServerLayout]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void pushSave();
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional snapshot deps
  }, [widgets, compact, thresholds]);

  async function pushSave() {
    const payload: ThunderCcLayoutDto = {
      v: 1,
      widgets: widgets.map((w) => ({
        id: w.id,
        widgetDefinitionId: w.widgetDefinitionId,
        position: w.position,
        visibility: w.visibility,
        order: w.order,
      })),
      compact,
      thresholds: { ...thresholds },
    };
    setStatus("saving");
    const res = await saveThunderCcLayout(payload);
    if (res.ok) {
      setStatus("ok");
      setHint(
        res.layout?.updatedAt
          ? `sauvé ${res.layout.updatedAt.slice(11, 19)}`
          : "sauvé",
      );
      window.setTimeout(() => setStatus("idle"), 2_000);
    } else {
      setStatus("err");
      setHint(res.error?.slice(0, 48) ?? "erreur");
    }
  }

  return (
    <div className={className}>
      <AButton
        type="button"
        size="sm"
        variant="secondary"
        disabled={status === "loading" || status === "saving"}
        onClick={() => void pushSave()}
        title="Persister le layout Thunder (USER / serveur)"
      >
        {status === "saving"
          ? "…"
          : status === "loading"
            ? "Sync…"
            : "Cloud"}
      </AButton>
      {hint ? (
        <span
          className={
            status === "err"
              ? "text-[length:var(--a-text-xs)] text-a-danger-fg"
              : "text-[length:var(--a-text-xs)] text-a-fg-subtle"
          }
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}
