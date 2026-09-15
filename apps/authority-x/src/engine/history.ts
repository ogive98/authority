import type { ActionId } from "./types";

const HISTORY_KEY = "authority-x.command-history.v1";
const HABIT_KEY = "authority-x.habit-stats.v1";
const MAX_HISTORY = 24;

export type HistoryEntry = {
  id: string;
  query: string;
  actionId: ActionId;
  entityId: string | null;
  at: string;
};

type HabitMap = Record<string, number>;

function habitKey(actionId: string, entityId: string | null): string {
  return `${actionId}::${entityId ?? "*"}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export function listHistory(): HistoryEntry[] {
  return readJson<HistoryEntry[]>(HISTORY_KEY, []);
}

export function pushHistory(entry: Omit<HistoryEntry, "id" | "at">): void {
  const next: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  const list = [next, ...listHistory().filter((h) => h.query !== entry.query)].slice(
    0,
    MAX_HISTORY,
  );
  writeJson(HISTORY_KEY, list);

  const habits = readJson<HabitMap>(HABIT_KEY, {});
  const k = habitKey(entry.actionId, entry.entityId);
  habits[k] = (habits[k] ?? 0) + 1;
  writeJson(HABIT_KEY, habits);
}

/** Soft boost from local habit counts (ranking only — never auto-executes). */
export function getHabitBoost(
  actionId: ActionId,
  entityId: string | null,
): number {
  const habits = readJson<HabitMap>(HABIT_KEY, {});
  const exact = habits[habitKey(actionId, entityId)] ?? 0;
  const wild = habits[habitKey(actionId, null)] ?? 0;
  return Math.min(35, exact * 6 + wild * 2);
}

export function clearHistory(): void {
  writeJson(HISTORY_KEY, []);
}
