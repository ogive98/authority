"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Package,
  Truck,
  UserRound,
  Warehouse,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortalDelivery, PortalDeliveryStatus } from "@/lib/customer-portal";
import { portalDeliveryStatusLabel } from "@/lib/customer-portal";

type StepId = "READY" | "ASSIGNED" | "OUT" | "DONE";

type JourneyStep = {
  id: StepId;
  label: string;
  hint: string;
  at: string | null;
};

function statusRank(status: PortalDeliveryStatus): number {
  if (status === "READY") return 0;
  if (status === "ASSIGNED") return 1;
  if (status === "OUT") return 2;
  if (status === "DELIVERED" || status === "FAILED") return 3;
  return 0;
}

function formatAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 16).replace("T", " ");
}

function buildSteps(delivery: PortalDelivery): JourneyStep[] {
  const failed = delivery.status === "FAILED";
  return [
    {
      id: "READY",
      label: "Prêt dépôt",
      hint: "Colis préparé pour expédition",
      at: formatAt(delivery.createdAt),
    },
    {
      id: "ASSIGNED",
      label: "Assigné",
      hint: delivery.driverLabel
        ? `Livreur : ${delivery.driverLabel}`
        : "En attente d’affectation livreur",
      at: formatAt(delivery.assignedAt),
    },
    {
      id: "OUT",
      label: "En route",
      hint: "Colis parti vers le client",
      at: formatAt(delivery.dispatchedAt),
    },
    {
      id: "DONE",
      label: failed ? "Échec" : "Livré",
      hint: failed
        ? delivery.failReason ?? "Livraison non aboutie"
        : "Remis au destinataire",
      at: formatAt(delivery.completedAt),
    },
  ];
}

function stepState(
  stepId: StepId,
  status: PortalDeliveryStatus,
): "done" | "current" | "todo" | "failed" {
  const rank = statusRank(status);
  const stepRank =
    stepId === "READY"
      ? 0
      : stepId === "ASSIGNED"
        ? 1
        : stepId === "OUT"
          ? 2
          : 3;

  if (status === "FAILED" && stepId === "DONE") return "failed";
  if (stepRank < rank) return "done";
  if (stepRank === rank) return "current";
  return "todo";
}

const STEP_ICON = {
  READY: Warehouse,
  ASSIGNED: UserRound,
  OUT: Truck,
  DONE: Package,
} as const;

/** Interactive schematic of the real shipment status (no GPS). */
export function PortalPackageJourney({
  delivery,
  className,
}: {
  delivery: PortalDelivery;
  className?: string;
}) {
  const steps = useMemo(() => buildSteps(delivery), [delivery]);
  const currentId = useMemo(() => {
    const rank = statusRank(delivery.status);
    return steps[Math.min(rank, steps.length - 1)]!.id;
  }, [delivery.status, steps]);
  const [focus, setFocus] = useState<StepId>(currentId);

  const focused = steps.find((s) => s.id === focus) ?? steps[0]!;
  const focusedState = stepState(focused.id, delivery.status);
  const progressPct =
    (statusRank(delivery.status) / Math.max(steps.length - 1, 1)) * 100;

  return (
    <section
      className={cn(
        "a-card overflow-hidden p-[var(--a-space-5)]",
        className,
      )}
      aria-label="Parcours du colis"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
            Schéma parcours
          </p>
          <h2 className="mt-1 text-[length:var(--a-text-sm)] font-medium text-a-fg">
            Suivi du colis · {delivery.number}
          </h2>
          <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
            Statut réel AUTHORITY — cliquez une étape. Pas de GPS / ETA.
          </p>
        </div>
        <p className="rounded-full bg-a-accent-muted px-3 py-1 text-[length:var(--a-text-xs)] font-medium text-a-accent">
          {portalDeliveryStatusLabel(delivery.status)}
        </p>
      </div>

      {/* SVG schematic path */}
      <div className="relative mt-6 overflow-x-auto pb-2">
        <svg
          viewBox="0 0 640 120"
          className="mx-auto h-28 w-full min-w-[20rem] max-w-3xl"
          role="img"
          aria-hidden
        >
          <defs>
            <linearGradient id="portal-path" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--a-accent)" stopOpacity="0.35" />
              <stop
                offset={`${progressPct}%`}
                stopColor="var(--a-accent)"
                stopOpacity="1"
              />
              <stop
                offset={`${progressPct}%`}
                stopColor="var(--a-border-strong)"
                stopOpacity="0.5"
              />
              <stop offset="100%" stopColor="var(--a-border-strong)" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          {/* Soft ground */}
          <path
            d="M40 78 C 140 58, 220 98, 320 72 S 500 48, 600 78"
            fill="none"
            stroke="var(--a-surface-3)"
            strokeWidth="18"
            strokeLinecap="round"
          />
          {/* Progress route */}
          <path
            d="M40 78 C 140 58, 220 98, 320 72 S 500 48, 600 78"
            fill="none"
            stroke="url(#portal-path)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="8 6"
            className="motion-safe:[animation:a-portal-dash_12s_linear_infinite]"
          />
          {/* Package marker along path approx by status */}
          {(() => {
            const xs = [40, 213, 400, 600];
            const ys = [78, 78, 72, 78];
            const i = Math.min(statusRank(delivery.status), 3);
            const x = xs[i]!;
            const y = ys[i]!;
            const failed = delivery.status === "FAILED";
            return (
              <g transform={`translate(${x}, ${y - 28})`}>
                <rect
                  x="-14"
                  y="-10"
                  width="28"
                  height="22"
                  rx="4"
                  fill={failed ? "var(--a-warning-soft)" : "var(--a-accent-muted)"}
                  stroke={failed ? "var(--a-warning)" : "var(--a-accent)"}
                  strokeWidth="1.5"
                />
                <path
                  d="M-14 -2 H14 M0 -10 V12"
                  stroke={failed ? "var(--a-warning)" : "var(--a-accent)"}
                  strokeWidth="1.5"
                />
                <circle
                  cx="0"
                  cy="18"
                  r="3"
                  fill={failed ? "var(--a-warning)" : "var(--a-accent)"}
                />
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Interactive steps */}
      <ol className="mt-2 grid gap-2 sm:grid-cols-4">
        {steps.map((step) => {
          const state = stepState(step.id, delivery.status);
          const Icon = STEP_ICON[step.id];
          const selected = focus === step.id;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => setFocus(step.id)}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex w-full flex-col items-start gap-2 rounded-[var(--a-radius-md)] border px-3 py-3 text-left transition-colors",
                  selected
                    ? "border-a-accent bg-a-accent-muted/60 ring-2 ring-a-focus-ring/40"
                    : "border-a-border-subtle bg-a-surface-2 hover:border-a-accent/40 hover:bg-a-surface-3/50",
                  state === "todo" && !selected && "opacity-60",
                )}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border",
                      state === "done" &&
                        "border-a-accent bg-a-accent text-a-accent-fg",
                      state === "current" &&
                        "border-a-accent bg-a-accent-muted text-a-accent",
                      state === "failed" &&
                        "border-a-warning bg-a-warning-soft text-a-warning-fg",
                      state === "todo" &&
                        "border-a-border-strong bg-a-surface-3 text-a-fg-muted",
                    )}
                  >
                    {state === "done" ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : state === "failed" ? (
                      <X className="h-4 w-4" aria-hidden />
                    ) : (
                      <Icon className="h-4 w-4" aria-hidden />
                    )}
                  </span>
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                    {state === "done"
                      ? "OK"
                      : state === "current"
                        ? "Ici"
                        : state === "failed"
                          ? "Échec"
                          : "…"}
                  </span>
                </span>
                <span className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                  {step.label}
                </span>
                <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
                  {step.at ?? "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Focus panel */}
      <div
        className={cn(
          "mt-4 rounded-[var(--a-radius-md)] border px-4 py-3",
          focusedState === "failed"
            ? "border-a-warning/40 bg-a-warning-soft/50"
            : "border-a-border-subtle bg-a-surface-3/50",
        )}
        role="status"
      >
        <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
          {focused.label}
        </p>
        <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
          {focused.hint}
        </p>
        {focused.at ? (
          <p className="a-mono mt-2 text-[length:var(--a-text-xs)] text-a-fg-subtle">
            Horodatage : {focused.at}
          </p>
        ) : (
          <p className="mt-2 text-[length:var(--a-text-xs)] text-a-fg-subtle">
            Étape non atteinte ou horodatage non renseigné.
          </p>
        )}
      </div>
    </section>
  );
}
