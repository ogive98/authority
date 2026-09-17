"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { ThunderMonitorSnapshot } from "@/lib/thunder/monitor-types";
import type { WidgetLoadState } from "@/lib/dashboard-engine";

const TIMEOUT_MS = 5_000;
const DEFAULT_POLL_MS = 15_000;
const EPS_HISTORY_MAX = 24;

type Listener = () => void;

type MonitorBusState = {
  snap: ThunderMonitorSnapshot | undefined;
  error: string | null;
  phase: "boot" | "ok" | "fail";
  fetching: boolean;
  /** events/s samples from successive polls (oldest → newest). */
  epsHistory: number[];
};

let state: MonitorBusState = {
  snap: undefined,
  error: null,
  phase: "boot",
  fetching: false,
  epsHistory: [],
};

const listeners = new Set<Listener>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let refCount = 0;
let pollMs = DEFAULT_POLL_MS;
let pullGen = 0;

function emit(next: MonitorBusState) {
  state = next;
  for (const l of listeners) l();
}

function getSnapshot(): MonitorBusState {
  return state;
}

function pushEps(history: number[], eps: number): number[] {
  const next = [...history, Math.max(0, eps)];
  if (next.length > EPS_HISTORY_MAX) next.splice(0, next.length - EPS_HISTORY_MAX);
  return next;
}

async function pullOnce(): Promise<void> {
  const gen = ++pullGen;
  emit({ ...state, fetching: true });
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/v1/thunder/monitor/snapshot", {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`monitor ${res.status}`);
    const snap = (await res.json()) as ThunderMonitorSnapshot;
    if (gen !== pullGen) return;
    const eps = snap.events?.eventsPerSecondEstimate ?? 0;
    emit({
      snap,
      error: null,
      phase: "ok",
      fetching: false,
      epsHistory: pushEps(state.epsHistory, eps),
    });
  } catch (e) {
    if (gen !== pullGen) return;
    emit({
      snap: state.snap,
      error: e instanceof Error ? e.message : "monitor error",
      phase: state.phase === "ok" || state.snap ? "ok" : "fail",
      fetching: false,
      epsHistory: state.epsHistory,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

function ensurePolling(intervalMs: number) {
  pollMs = Math.min(pollMs, intervalMs);
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  if (refCount <= 0) return;
  pollTimer = window.setInterval(() => {
    void pullOnce();
  }, pollMs);
}

function acquire(intervalMs: number) {
  refCount += 1;
  if (refCount === 1) {
    pollMs = intervalMs;
    void pullOnce();
    ensurePolling(intervalMs);
  } else if (intervalMs < pollMs) {
    ensurePolling(intervalMs);
  }
}

function release() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
    pollMs = DEFAULT_POLL_MS;
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Shared Thunder monitor — one poll bus, generation-safe fetch, no SSE.
 */
export function useThunderMonitor(opts?: {
  live?: boolean;
  intervalMs?: number;
}) {
  const live = opts?.live !== false;
  const intervalMs = opts?.intervalMs ?? DEFAULT_POLL_MS;
  const bus = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!live) return;
    acquire(intervalMs);
    return () => release();
  }, [live, intervalMs]);

  const refresh = useCallback(() => pullOnce(), []);

  const loadState: WidgetLoadState = bus.snap
    ? bus.phase === "fail"
      ? "stale"
      : "loaded"
    : bus.phase === "boot" || bus.fetching
      ? "loading"
      : "unavailable";

  return {
    data: bus.snap,
    error: bus.error,
    loading: !bus.snap && (bus.phase === "boot" || bus.fetching),
    fetching: bus.fetching,
    loadState,
    epsHistory: bus.epsHistory,
    refresh,
  };
}

/** @deprecated alias — Command Center */
export function useThunderCcSnapshot(opts?: { live?: boolean }) {
  return useThunderMonitor({ live: opts?.live, intervalMs: 12_000 });
}
