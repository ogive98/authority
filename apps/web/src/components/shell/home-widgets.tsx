"use client";

/**
 * Above-the-fold Mission Control widgets (D296).
 * Below-fold bodies live in `home-widgets-deferred.tsx` for next/dynamic.
 */
import Link from "next/link";
import {
  fetchBusinessMeClient,
  initialsFromName,
} from "@/lib/business-auth";
import { ASkeleton } from "@/components/a/a-skeleton";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useHomeKpis } from "@/hooks/use-home-kpis";
import { useShellT } from "@/stores/locale-store";

function greetingForHour(
  h: number,
  t: (key: import("@/stores/locale-store").ShellMessageKey) => string,
): string {
  if (h < 12) return t("greetMorning");
  if (h < 18) return t("greetAfternoon");
  return t("greetEvening");
}

/** Hero — identity from /me only (no fake KPI). D294 greeting. */
export function HeroContextWidget() {
  const { t } = useShellT();
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchBusinessMeClient();
      if (cancelled) return;
      if (res.ok) {
        setName(res.data.displayName);
        setRole(res.data.roleLabel ?? res.data.roleCode ?? null);
      }
      setPending(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (pending) return <ASkeleton lines={2} />;

  const hour = new Date().getHours();
  const greet = greetingForHour(hour, t);
  const display = name ?? t("operatorFallback");
  const initials = initialsFromName(display, "");

  return (
    <div className="a-card flex flex-wrap items-end justify-between gap-4 p-4 md:p-5">
      <div className="min-w-0">
        <h2 className="text-[length:var(--a-text-xl)] font-medium tracking-[-0.02em] text-a-fg">
          {greet}, {display.split(" ")[0]}
        </h2>
        <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
          {role ?? t("accountFallback")}
          <span className="text-a-fg-subtle"> · </span>
          <span className="a-mono text-a-fg-subtle">{initials}</span>
        </p>
      </div>
      <Link
        href="/account"
        className="rounded-[var(--a-radius-sm)] bg-a-accent-muted px-3 py-1.5 text-[length:var(--a-text-xs)] font-medium text-a-accent transition-colors hover:bg-a-accent hover:text-a-accent-fg"
      >
        {t("controlCenter")}
      </Link>
    </div>
  );
}

const KPI_LABEL_KEYS: Record<
  import("@/lib/home-kpis").HomeKpiId,
  import("@/stores/locale-store").ShellMessageKey
> = {
  arOpen: "kpiArOpen",
  ordersActive: "kpiOrders",
  ordersDraft: "kpiOrdersDraft",
  ordersConfirmed: "kpiOrdersConfirmed",
  stockLines: "kpiStock",
  stockBalances: "kpiStockBalances",
  stockLots: "kpiStockLots",
  overdue: "kpiOverdue",
  shipmentsActive: "kpiShipmentsActive",
  shipmentsReady: "kpiShipmentsReady",
  shipmentsOut: "kpiShipmentsOut",
  backupTotal: "kpiBackupTotal",
  backupRestorable: "kpiBackupRestorable",
  backupOpenRestores: "kpiBackupOpenRestores",
  backupFailed: "kpiBackupFailed",
  moduleFeatures: "kpiModuleFeatures",
};

/** Live KPI strip — scoped to selected module (D168/D294). Live values only. */
export function HomeKpiStrip() {
  const { t } = useShellT();
  const q = useHomeKpis();

  if (q.isPending && !q.data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="a-card flex min-h-[7.5rem] flex-col justify-between rounded-[var(--a-radius-md)] p-4"
          >
            <ASkeleton className="h-3 w-24" />
            <ASkeleton className="h-8 w-32" />
            <ASkeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
    );
  }

  const cards = q.data ?? [];
  if (cards.length === 0) return null;

  const cols =
    cards.length === 1
      ? "sm:grid-cols-1 max-w-sm"
      : cards.length === 2
        ? "sm:grid-cols-2"
        : cards.length === 3
          ? "sm:grid-cols-2 xl:grid-cols-3"
          : "sm:grid-cols-2 xl:grid-cols-4";

  return (
    <div className={cn("grid gap-3", cols)}>
      {cards.map((card) => {
        const label = t(KPI_LABEL_KEYS[card.id]);
        const muted = card.state !== "ok";
        const hint =
          card.state === "ok"
            ? null
            : card.state === "module_off"
              ? t("kpiModuleOff")
              : card.state === "forbidden"
                ? t("kpiForbidden")
                : card.state === "empty"
                  ? t("kpiEmptyModule")
                  : t("kpiUnavailable");
        return (
          <Link
            key={card.id}
            href={card.href}
            className="a-card a-stagger-in flex min-h-[7.5rem] flex-col justify-between p-4 transition-colors hover:bg-a-surface-3/50"
          >
            <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-[0.08em] text-a-fg-muted">
              {label}
            </p>
            <div>
              <p
                className={cn(
                  "a-mono a-tabular text-[length:var(--a-text-2xl)] font-medium tracking-tight",
                  muted ? "text-a-fg-subtle" : "text-a-fg",
                )}
              >
                {card.value}
              </p>
              {hint ? (
                <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
                  {hint}
                </p>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
