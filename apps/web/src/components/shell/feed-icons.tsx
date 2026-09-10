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
  /** Liquid glass disc class (iOS-like). */
  liquidClass?: string;
};

/** Notification types — semantic color + dedicated glyph. */
const NOTIFICATION_ICONS: Record<NotificationType, FeedIconDef> = {
  success: {
    icon: CheckCircle2,
    toneClass: "text-a-success",
    softBg: "bg-a-success-soft",
    label: "Succès",
    liquidClass: "a-liquid-translate",
  },
  info: {
    icon: Info,
    toneClass: "text-a-info",
    softBg: "bg-a-info-soft",
    label: "Info",
    liquidClass: "a-liquid-calendar",
  },
  warning: {
    icon: AlertTriangle,
    toneClass: "text-a-warning",
    softBg: "bg-a-warning-soft",
    label: "Alerte",
    liquidClass: "a-liquid-notes",
  },
  danger: {
    icon: ShieldAlert,
    toneClass: "text-a-danger",
    softBg: "bg-a-danger-soft",
    label: "Critique",
    liquidClass: "a-liquid-calc",
  },
  task: {
    icon: ClipboardList,
    toneClass: "text-a-accent",
    softBg: "bg-a-accent-muted",
    label: "Tâche",
    liquidClass: "a-liquid-agenda",
  },
  system: {
    icon: CloudLightning,
    toneClass: "text-a-accent-2",
    softBg: "bg-a-info-soft",
    label: "Système",
    liquidClass: "a-liquid-translate",
  },
};

/** AI recommendations — violet liquid family (lock), distinct chroma. */
const AI_ICONS: Record<AiRecommendationKind, FeedIconDef> = {
  stock: {
    icon: PackagePlus,
    toneClass: "text-white",
    softBg: "bg-[var(--a-violet-soft)]",
    label: "Stock",
    liquidClass: "a-liquid-ai-stock",
  },
  forecast: {
    icon: LineChart,
    toneClass: "text-white",
    softBg: "bg-[var(--a-violet-soft)]",
    label: "Prévision",
    liquidClass: "a-liquid-ai-forecast",
  },
  pricing: {
    icon: TrendingUp,
    toneClass: "text-white",
    softBg: "bg-[var(--a-violet-soft)]",
    label: "Prix",
    liquidClass: "a-liquid-ai-pricing",
  },
  quality: {
    icon: ShieldAlert,
    toneClass: "text-white",
    softBg: "bg-[var(--a-violet-soft)]",
    label: "Qualité",
    liquidClass: "a-liquid-ai-quality",
  },
  ops: {
    icon: Wrench,
    toneClass: "text-white",
    softBg: "bg-[var(--a-violet-soft)]",
    label: "Ops",
    liquidClass: "a-liquid-ai-ops",
  },
  generic: {
    icon: Sparkles,
    toneClass: "text-white",
    softBg: "bg-[var(--a-violet-soft)]",
    label: "IA",
    liquidClass: "a-liquid-ai-generic",
  },
};

const ACTIVITY_EXTRA: Record<"user" | "metric" | "idle", FeedIconDef> = {
  user: {
    icon: UserRound,
    toneClass: "text-a-accent",
    softBg: "bg-a-accent-muted",
    label: "Utilisateur",
    liquidClass: "a-liquid-translate",
  },
  metric: {
    icon: Gauge,
    toneClass: "text-a-accent-2",
    softBg: "bg-a-info-soft",
    label: "Métrique",
    liquidClass: "a-liquid-calendar",
  },
  idle: {
    icon: Activity,
    toneClass: "text-a-fg-muted",
    softBg: "bg-a-surface-3",
    label: "Activité",
  },
};

/** Exact module shortcuts for AI placeholder rows. */
export const AI_REC_HREF: Record<AiRecommendationKind, string> = {
  stock: "/inventory",
  forecast: "/sales",
  pricing: "/finance",
  quality: "/inventory/lots",
  ops: "/settings",
  generic: "/",
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

/** Compact glyph — soft underlay disc. */
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
  href: string;
}[] = [
  { kind: "stock", title: "Réapprovisionner (dès API)", href: AI_REC_HREF.stock },
  {
    kind: "forecast",
    title: "Prévision demande (dès API)",
    href: AI_REC_HREF.forecast,
  },
  {
    kind: "pricing",
    title: "Ajustement tarif (dès API)",
    href: AI_REC_HREF.pricing,
  },
  {
    kind: "quality",
    title: "Alerte qualité (dès API)",
    href: AI_REC_HREF.quality,
  },
  { kind: "ops", title: "Optimisation ops (dès API)", href: AI_REC_HREF.ops },
];
