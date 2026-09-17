/**
 * Alert thresholds — configurable, never hardcoded in widgets.
 * V1: local prefs; later Prefs VALIDATED / company settings.
 */

export type ThunderAlertThresholds = {
  cpuWarn: number;
  cpuCrit: number;
  ramWarn: number;
  ramCrit: number;
  queueWarn: number;
  queueCrit: number;
  eventFailWarnPerMin: number;
  eventFailCritPerMin: number;
  apiLatencyWarnMs: number;
  apiLatencyCritMs: number;
};

export const DEFAULT_THUNDER_ALERT_THRESHOLDS: ThunderAlertThresholds = {
  cpuWarn: 0.75,
  cpuCrit: 0.9,
  ramWarn: 0.8,
  ramCrit: 0.92,
  queueWarn: 100,
  queueCrit: 500,
  eventFailWarnPerMin: 10,
  eventFailCritPerMin: 50,
  apiLatencyWarnMs: 500,
  apiLatencyCritMs: 2000,
};

export type ThunderAlertHit = {
  id: string;
  code: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  metric: string;
  value: number;
  threshold: number;
};

export function evaluateThunderAlerts(
  metrics: {
    cpuRatio: number | null;
    ramRatio: number;
    queuePending: number;
    jobFailed: number;
    apiP95Ms: number | null;
    outboxDlq: number;
  },
  t: ThunderAlertThresholds = DEFAULT_THUNDER_ALERT_THRESHOLDS,
): ThunderAlertHit[] {
  const hits: ThunderAlertHit[] = [];
  if (metrics.cpuRatio != null) {
    if (metrics.cpuRatio >= t.cpuCrit) {
      hits.push({
        id: "cpu-crit",
        code: "CPU_CRITICAL",
        severity: "CRITICAL",
        message: `CPU ≥ ${Math.round(t.cpuCrit * 100)}%`,
        metric: "cpu",
        value: metrics.cpuRatio,
        threshold: t.cpuCrit,
      });
    } else if (metrics.cpuRatio >= t.cpuWarn) {
      hits.push({
        id: "cpu-warn",
        code: "CPU_WARNING",
        severity: "WARNING",
        message: `CPU ≥ ${Math.round(t.cpuWarn * 100)}%`,
        metric: "cpu",
        value: metrics.cpuRatio,
        threshold: t.cpuWarn,
      });
    }
  }
  if (metrics.ramRatio >= t.ramCrit) {
    hits.push({
      id: "ram-crit",
      code: "RAM_CRITICAL",
      severity: "CRITICAL",
      message: `RAM ≥ ${Math.round(t.ramCrit * 100)}%`,
      metric: "ram",
      value: metrics.ramRatio,
      threshold: t.ramCrit,
    });
  } else if (metrics.ramRatio >= t.ramWarn) {
    hits.push({
      id: "ram-warn",
      code: "RAM_WARNING",
      severity: "WARNING",
      message: `RAM ≥ ${Math.round(t.ramWarn * 100)}%`,
      metric: "ram",
      value: metrics.ramRatio,
      threshold: t.ramWarn,
    });
  }
  if (metrics.queuePending >= t.queueCrit) {
    hits.push({
      id: "q-crit",
      code: "QUEUE_CRITICAL",
      severity: "CRITICAL",
      message: `Queue pending ≥ ${t.queueCrit}`,
      metric: "queue.pending",
      value: metrics.queuePending,
      threshold: t.queueCrit,
    });
  } else if (metrics.queuePending >= t.queueWarn) {
    hits.push({
      id: "q-warn",
      code: "QUEUE_WARNING",
      severity: "WARNING",
      message: `Queue pending ≥ ${t.queueWarn}`,
      metric: "queue.pending",
      value: metrics.queuePending,
      threshold: t.queueWarn,
    });
  }
  if (metrics.apiP95Ms != null) {
    if (metrics.apiP95Ms >= t.apiLatencyCritMs) {
      hits.push({
        id: "api-crit",
        code: "API_LATENCY_CRITICAL",
        severity: "CRITICAL",
        message: `API p95 ≥ ${t.apiLatencyCritMs}ms`,
        metric: "api.p95",
        value: metrics.apiP95Ms,
        threshold: t.apiLatencyCritMs,
      });
    } else if (metrics.apiP95Ms >= t.apiLatencyWarnMs) {
      hits.push({
        id: "api-warn",
        code: "API_LATENCY_WARNING",
        severity: "WARNING",
        message: `API p95 ≥ ${t.apiLatencyWarnMs}ms`,
        metric: "api.p95",
        value: metrics.apiP95Ms,
        threshold: t.apiLatencyWarnMs,
      });
    }
  }
  if (metrics.outboxDlq > 0) {
    hits.push({
      id: "outbox-dlq",
      code: "OUTBOX_DLQ",
      severity: "ERROR",
      message: `Outbox DLQ ${metrics.outboxDlq}`,
      metric: "outbox.dlq",
      value: metrics.outboxDlq,
      threshold: 1,
    });
  }
  if (metrics.jobFailed >= t.eventFailCritPerMin) {
    hits.push({
      id: "fail-crit",
      code: "JOB_FAIL_CRITICAL",
      severity: "CRITICAL",
      message: `Jobs failed ≥ ${t.eventFailCritPerMin}`,
      metric: "jobs.failed",
      value: metrics.jobFailed,
      threshold: t.eventFailCritPerMin,
    });
  } else if (metrics.jobFailed >= t.eventFailWarnPerMin) {
    hits.push({
      id: "fail-warn",
      code: "JOB_FAIL_WARNING",
      severity: "WARNING",
      message: `Jobs failed ≥ ${t.eventFailWarnPerMin}`,
      metric: "jobs.failed",
      value: metrics.jobFailed,
      threshold: t.eventFailWarnPerMin,
    });
  }
  return hits;
}
