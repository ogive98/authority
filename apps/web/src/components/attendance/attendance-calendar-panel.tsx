"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ABadge,
  AButton,
  AEmptyState,
  AErrorState,
  AInput,
  APageSection,
  ASkeleton,
} from "@/components/a";
import {
  calendarKindLabel,
  calendarKindTone,
  createRhEvent,
  fetchAttendanceCalendar,
  type AttCalendarEntry,
  type AttCalendarKind,
} from "@/lib/attendance";
import { EMPLOYEE_PORTAL_API } from "@/lib/employee-portal";
import { softTableWrap, softThead, softTr } from "@/lib/d294-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: AttCalendarEntry[] }
  | { kind: "error"; message: string };

function monthBounds(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const year = y ?? new Date().getUTCFullYear();
  const month = (m ?? 1) - 1;
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 0));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y ?? 2026, m ?? 1, 0)).getUTCDate();
}

function dayKindMap(
  items: AttCalendarEntry[],
  ym: string,
): Map<number, AttCalendarKind> {
  const map = new Map<number, AttCalendarKind>();
  const { from, to } = monthBounds(ym);
  for (const row of items) {
    const start = row.startDate < from ? from : row.startDate;
    const end = row.endDate > to ? to : row.endDate;
    if (end < from || start > to) continue;
    const s = Number(start.slice(8, 10));
    const e = Number(end.slice(8, 10));
    for (let d = s; d <= e; d++) {
      const prev = map.get(d);
      // Priority: PENALTY > ABSENCE > LEAVE
      if (!prev || row.kind === "PENALTY") map.set(d, row.kind);
      else if (row.kind === "ABSENCE" && prev === "LEAVE") map.set(d, "ABSENCE");
    }
  }
  return map;
}

function dayClass(kind: AttCalendarKind | undefined): string {
  if (kind === "LEAVE") return "bg-a-success-soft text-a-success-fg";
  if (kind === "ABSENCE") return "bg-a-danger-soft text-a-danger-fg";
  if (kind === "PENALTY") return "bg-a-warning-soft text-a-warning-fg";
  return "bg-a-surface-3 text-a-fg-muted";
}

/**
 * Attendance calendar (D220).
 * ADV: canAddPenalty. Portal: read-only via portal API.
 */
export function AttendanceCalendarPanel({
  employeeId,
  mode,
}: {
  employeeId: string;
  mode: "adv" | "portal";
}) {
  const now = new Date();
  const [ym, setYm] = useState(
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
  );
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const { from, to } = monthBounds(ym);
    if (mode === "portal") {
      try {
        const res = await fetch(EMPLOYEE_PORTAL_API.calendar, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          setState({ kind: "error", message: "Impossible de charger le calendrier." });
          return;
        }
        const all = (await res.json()) as AttCalendarEntry[];
        const items = all.filter(
          (r) => r.endDate >= from && r.startDate <= to,
        );
        setState({ kind: "ok", items });
      } catch {
        setState({ kind: "error", message: "API indisponible." });
      }
      return;
    }
    const res = await fetchAttendanceCalendar({ employeeId, from, to });
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({ kind: "ok", items: res.data });
  }, [employeeId, mode, ym]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDay = useMemo(
    () => (state.kind === "ok" ? dayKindMap(state.items, ym) : new Map()),
    [state, ym],
  );
  const dim = daysInMonth(ym);

  async function onAddPenalty() {
    if (!motif.trim() || !startDate || !endDate) {
      setFormError("Motif, début et fin sont requis.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createRhEvent({
      employeeId,
      startDate,
      endDate,
      motif: motif.trim(),
      kind: "PENALTY",
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setMotif("");
    setStartDate("");
    setEndDate("");
    void load();
  }

  return (
    <APageSection
      title="Calendrier présence"
      description="Congés approuvés (vert) · absences UNPAID (rouge) · pénalités ADV (orange). Pas de soldes inventés."
      action={
        <label className="block space-y-1">
          <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
            Mois
          </span>
          <AInput
            type="month"
            value={ym}
            onChange={(e) => setYm(e.target.value)}
            className="a-mono"
          />
        </label>
      }
    >

      <div className="flex flex-wrap gap-2 text-[length:var(--a-text-xs)]">
        <span className="rounded-md bg-a-success-soft px-2 py-1 text-a-success-fg">
          Congé
        </span>
        <span className="rounded-md bg-a-danger-soft px-2 py-1 text-a-danger-fg">
          Absence
        </span>
        <span className="rounded-md bg-a-warning-soft px-2 py-1 text-a-warning-fg">
          Pénalité
        </span>
      </div>

      {state.kind === "loading" ? <ASkeleton className="h-40 w-full" /> : null}
      {state.kind === "error" ? (
        <AErrorState message={state.message} retryable onRetry={() => void load()} />
      ) : null}

      {state.kind === "ok" ? (
        <>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {Array.from({ length: dim }, (_, i) => {
              const day = i + 1;
              const kind = byDay.get(day);
              return (
                <div
                  key={day}
                  className={`flex min-h-10 flex-col items-center justify-center rounded-[10px] text-[length:var(--a-text-xs)] a-tabular ${dayClass(kind)}`}
                  title={kind ? calendarKindLabel(kind) : undefined}
                >
                  <span className="font-medium">{day}</span>
                  {kind ? (
                    <span className="text-[9px] uppercase tracking-wide opacity-90">
                      {kind === "LEAVE"
                        ? "C"
                        : kind === "ABSENCE"
                          ? "A"
                          : "P"}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {state.items.length === 0 ? (
            <AEmptyState
              title="Aucune entrée ce mois"
              description="Les congés APPROVED, absences UNPAID et pénalités apparaîtront ici."
            />
          ) : (
            <div className={softTableWrap}>
              <table className="w-full min-w-[520px] text-left text-[length:var(--a-text-sm)]">
                <thead className={softThead}>
                  <tr>
                    <th className="a-table-cell font-medium">Type</th>
                    <th className="a-table-cell font-medium">Période</th>
                    <th className="a-table-cell font-medium">Motif</th>
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((row) => (
                    <tr key={`${row.source}-${row.id}`} className={softTr}>
                      <td className="a-table-cell">
                        <ABadge tone={calendarKindTone(row.kind)}>
                          {calendarKindLabel(row.kind)}
                          {row.type ? ` · ${row.type}` : ""}
                        </ABadge>
                      </td>
                      <td className="a-mono a-tabular a-table-cell">
                        {row.startDate} → {row.endDate}
                      </td>
                      <td className="a-table-cell text-a-fg-muted">
                        {row.motif ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {mode === "adv" ? (
        <div className="space-y-3 border-t border-transparent pt-2">
          <h3 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
            Ajouter une pénalité (ADV)
          </h3>
          {formError ? (
            <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
              {formError}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1 sm:col-span-3">
              <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Motif
              </span>
              <AInput
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Obligatoire"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Début
              </span>
              <AInput
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Fin
              </span>
              <AInput
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
            <div className="flex items-end">
              <AButton
                type="button"
                disabled={busy}
                onClick={() => void onAddPenalty()}
              >
                Enregistrer
              </AButton>
            </div>
          </div>
        </div>
      ) : null}
    </APageSection>
  );
}
