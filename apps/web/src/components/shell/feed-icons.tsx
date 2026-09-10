"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  CloudLightning,
  Gauge,
  Info,
  LineChart,
  PackagePlus,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UserRound,
  Wrench,
} from "lucide-react";
import type { NotificationType } from "@/lib/notifications";
import { cn } from "@/lib/utils";

/** AI recommendation kinds (UI taxonomy — data later). */
export type AiRecommendationKind =
  | "stock"
  | "forecast"
  | "pricing"
  | "quality"
  | "ops"
  | "generic";

/** Activity feed kinds. */
export type ActivityKind =
  | NotificationType
  | "user"
  | "metric"
  | "idle";

export type FeedIconDef = {
  icon: LucideIcon;
  toneClass: string;
  softBg: string;
  label: string;
};

/** Notification types — semantic color + dedicated glyph. */
const NOTIFICATION_ICONS: Record<NotificationType, FeedIconDef> = {
  success: {
    icon: CheckCircle2,
    toneClass: "text-a-success",
    softBg: "bg-a-success-soft",
    label: "Succès",
  },
  info: {
    icon: Info,
    toneClass: "text-a-info",
    softBg: "bg-a-info-soft",
    label: "Info",
  },
  warning: {
    icon: AlertTriangle,
    toneClass: "text-a-warning",
    softBg: "bg-a-warning-soft",
    label: "Alerte",
  },
  danger: {
    icon: ShieldAlert,
    toneClass: "text-a-danger",
    softBg: "bg-a-danger-soft",
    label: "Critique",
  },
  task: {
    icon: ClipboardList,
    toneClass: "text-a-accent",
    softBg: "bg-a-accent-muted",
    label: "Tâche",
  },
  system: {
    icon: CloudLightning,
    toneClass: "text-a-accent-2",
    softBg: "bg-a-info-soft",
    label: "Système",
  },
};

/** AI recommendations — violet family only (lock), distinct icons. */
const AI_ICONS: Record<AiRecommendationKind, FeedIconDef> = {
  stock: {
    icon: PackagePlus,
    toneClass: "text-[var(--a-violet)]",
    softBg: "bg-[var(--a-violet-soft)]",
    label: "Stock",
  },
  forecast: {
    icon: LineChart,
    toneClass: "text-[var(--a-violet)]",
    softBg: "bg-[var(--a-violet-soft)]",
    label: "Prévision",
  },
  pricing: {
    icon: TrendingUp,
    toneClass: "text-[var(--a-violet)]",
    softBg: "bg-[var(--a-violet-soft)]",
    label: "Prix",
  },
  quality: {
    icon: ShieldAlert,
    toneClass: "text-[var(--a-violet)]",
    softBg: "bg-[var(--a-violet-soft)]",
    label: "Qualité",
  },
  ops: {
    icon: Wrench,
    toneClass: "text-[var(--a-violet)]",
    softBg: "bg-[var(--a-violet-soft)]",
    label: "Ops",
  },
  generic: {
    icon: Sparkles,
    toneClass: "text-[var(--a-violet)]",
    softBg: "bg-[var(--a-violet-soft)]",
    label: "IA",
  },
};

const ACTIVITY_EXTRA: Record<"user" | "metric" | "idle", FeedIconDef> = {
  user: {
    icon: UserRound,
    toneClass: "text-a-accent",
    softBg: "bg-a-accent-muted",
    label: "Utilisateur",
  },
  metric: {
    icon: Gauge,
    toneClass: "text-a-accent-2",
    softBg: "bg-a-info-soft",
    label: "Métrique",
  },
  idle: {
    icon: Activity,
    toneClass: "text-a-fg-muted",
    softBg: "bg-a-surface-3",
    label: "Activité",
  },
};

export function iconForNotificationType(type: NotificationType): FeedIconDef {
  return (
    NOTIFICATION_ICONS[type] ?? {
      icon: Bell,
      toneClass: "text-a-fg-muted",
      softBg: "bg-a-surface-3",
      label: "Notification",
    }
  );
}

export function iconForAiRecommendation(
  kind: AiRecommendationKind,
): FeedIconDef {
  return AI_ICONS[kind] ?? AI_ICONS.generic;
}

export function iconForActivity(kind: ActivityKind): FeedIconDef {
  if (kind === "user" || kind === "metric" || kind === "idle") {
    return ACTIVITY_EXTRA[kind];
  }
  return iconForNotificationType(kind);
}

/** Compact glyph — soft tinted underlay, no hard frame. */
export function FeedGlyph({
  def,
  className,
  size = 15,
  strokeWidth = 1.65,
}: {
  def: FeedIconDef;
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = def.icon;
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px]",
        def.softBg,
        def.toneClass,
        className,
      )}
      title={def.label}
      aria-hidden
    >
      <Icon width={size} height={size} strokeWidth={strokeWidth} />
    </span>
  );
}

/** Placeholder AI rows when engine is DISABLED (structure + icons only). */
export const AI_REC_PLACEHOLDERS: {
  kind: AiRecommendationKind;
  title: string;
}[] = [
  { kind: "stock", title: "Réapprovisionner (dès API)" },
  { kind: "forecast", title: "Prévision demande (dès API)" },
  { kind: "pricing", title: "Ajustement tarif (dès API)" },
  { kind: "quality", title: "Alerte qualité (dès API)" },
  { kind: "ops", title: "Optimisation ops (dès API)" },
];
