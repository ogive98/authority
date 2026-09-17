"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { HealthItem } from "@/lib/dashboard-engine";
import { useUiT } from "@/lib/i18n/route-labels";
import {
  domainsFromHealthItems,
  THUNDER_HEALTH_REPAIR_DOMAIN,
} from "@/lib/thunder/health-repair-links";
import {
  runThunderHealthRepairAction,
  type ThunderHealthRepairAction,
} from "@/lib/thunder/run-health-repair-action";
import { useRepairSessionStore } from "@/stores/repair-session-store";
import { cn } from "@/lib/utils";

export type ThunderHealthMenuState = {
  x: number;
  y: number;
  focusItem: HealthItem | null;
};

type Props = {
  open: ThunderHealthMenuState | null;
  onClose: () => void;
  items: HealthItem[];
  onRefresh?: () => void;
};

type Entry = {
  id: ThunderHealthRepairAction | "open";
  label: string;
  hint?: string;
  danger?: boolean;
  href?: string;
  action?: ThunderHealthRepairAction;
};

export function ThunderHealthContextMenu({
  open,
  onClose,
  items,
  onRefresh,
}: Props) {
  const { t } = useUiT();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const lastAction = useRepairSessionStore((s) => s.lastAction);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const focus = open.focusItem;
  const unhealthy = items.filter((i) =>
    ["DEGRADED", "WARNING", "CRITICAL", "OFFLINE"].includes(i.state),
  );
  const domains = focus
    ? [THUNDER_HEALTH_REPAIR_DOMAIN[focus.id] ?? "L0"]
    : domainsFromHealthItems(items);

  const run = async (action: ThunderHealthRepairAction) => {
    if (busy) return;
    setBusy(true);
    onClose();
    try {
      await runThunderHealthRepairAction({
        action,
        items,
        focus,
        onRefresh,
      });
    } finally {
      setBusy(false);
    }
  };

  const entries: Entry[] = [
    {
      id: "scan",
      label: t("Scanner maintenant"),
      hint: t("Scan Quick · Runtime + Kernel"),
      action: "scan",
    },
    {
      id: "diagnostics",
      label: t("Diagnostics"),
      hint: t("Findings · incidents"),
      action: "diagnostics",
    },
    {
      id: "critical",
      label: t("Dépanner alertes critiques / dégradées"),
      hint:
        unhealthy.length > 0
          ? `${unhealthy.length} · ${domains.join("+")}`
          : t("Aucune alerte — scan L0/L1"),
      action: "critical",
    },
    {
      id: "serious",
      label: t("Réparer sérieusement"),
      hint: t("Deep L2 · scénarios SAFE/LOW allowlistés"),
      danger: true,
      action: "serious",
    },
  ];

  if (focus) {
    entries.unshift({
      id: "focus",
      label: `${t("Dépanner")} · ${focus.label}`,
      hint: `${focus.state}${focus.detail ? ` · ${focus.detail}` : ""}`,
      action: "focus",
    });
  }

  if (onRefresh) {
    entries.push({
      id: "refresh",
      label: t("Rafraîchir le snapshot"),
      action: "refresh",
    });
  }

  entries.push({
    id: "open",
    label: t("Voir module Repair"),
    hint: t("Journal + exécution live"),
    href: "/repair",
  });

  const pad = 8;
  const approxW = 272;
  const approxH = 12 + entries.length * 40;
  const left = Math.min(
    Math.max(pad, open.x),
    Math.max(pad, window.innerWidth - approxW - pad),
  );
  const top = Math.min(
    Math.max(pad, open.y),
    Math.max(pad, window.innerHeight - approxH - pad),
  );

  const running = busy || lastAction?.status === "running";

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={t("Actions Repair Thunder Health")}
      className="fixed z-[var(--a-z-dropdown)] min-w-[15rem] max-w-[18rem] bg-a-surface-2 py-1"
      style={{
        left,
        top,
        boxShadow: "var(--a-shadow-card)",
        border: "1px solid var(--a-border-subtle)",
        borderRadius: "var(--a-radius-md)",
      }}
    >
      <p className="px-3 py-1 text-[length:var(--a-text-xs)] text-a-fg-subtle">
        {focus ? focus.label : t("Thunder Health")}
        {running ? ` · ${t("En cours…")}` : ""}
      </p>
      <ul>
        {entries.map((e) => {
          const className = cn(
            "flex w-full flex-col gap-0.5 px-3 py-1.5 text-left transition-colors",
            "hover:bg-a-surface-3 focus-visible:bg-a-surface-3 focus-visible:outline-none",
            e.danger && "text-a-warning-fg",
            running && e.action && "opacity-50",
          );
          if (e.href) {
            return (
              <li key={e.id}>
                <Link
                  role="menuitem"
                  href={e.href}
                  className={className}
                  onClick={onClose}
                >
                  <span className="text-[length:var(--a-text-sm)] text-a-fg">
                    {e.label}
                  </span>
                  {e.hint ? (
                    <span className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                      {e.hint}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          }
          return (
            <li key={e.id}>
              <button
                type="button"
                role="menuitem"
                disabled={running}
                className={className}
                onClick={() => {
                  if (e.action) void run(e.action);
                }}
              >
                <span className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                  {e.label}
                </span>
                {e.hint ? (
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                    {e.hint}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}
