/** Client for ERP Repair APIs (`/api/v1/repair`) — Utility Cube module. */

const REPAIR_API = "/api/v1/repair";

async function repairFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: T | null; message?: string }> {
  try {
    const res = await fetch(`${REPAIR_API}${path}`, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init?.body
          ? { "Content-Type": "application/json" }
          : undefined),
        ...init?.headers,
      },
      ...init,
    });
    const body = (await res.json().catch(() => null)) as T & {
      message?: string;
    };
    if (!res.ok) {
      return {
        status: res.status,
        data: null,
        message:
          (body as { message?: string } | null)?.message ??
          `HTTP ${res.status}`,
      };
    }
    return { status: res.status, data: body as T };
  } catch {
    return { status: 503, data: null, message: "API indisponible" };
  }
}

export type RepairDashboard = {
  health: string;
  lastScanId: string | null;
  openFindings: number;
  openIncidents: number;
  pendingRepairs: number;
  reportingQueued: number;
  pipeline: string[];
  scenarios?: number;
  signatures?: number;
  coverage?: {
    totalScenarios: number;
    executableCount: number;
    safeLowTotal: number;
    safeLowExecutable: number;
    blockedCount: number;
    completeAllowedSurface: boolean;
  };
};

export async function fetchRepairDashboard() {
  return repairFetch<RepairDashboard>("/dashboard");
}

export async function fetchRepairHealth() {
  return repairFetch<{ status: string; engines: Record<string, string> }>(
    "/health",
  );
}

export async function runRepairScan(body: {
  depth: string;
  domains: string[];
  companyId?: string;
}) {
  return repairFetch<{
    scan: {
      id: string;
      status: string;
      findingCount: number;
      depth: string;
    };
    findings: Array<{
      id: string;
      component: string;
      severity: string;
      signatureId: string | null;
      evidenceSummary: string;
      risk: string;
    }>;
  }>("/health/scan", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchRepairFindings() {
  return repairFetch<{
    items: Array<{
      id: string;
      component: string;
      severity: string;
      signatureId: string | null;
      evidenceSummary: string;
      risk: string;
      state: string;
    }>;
  }>("/diagnostics/findings");
}

export async function fetchRepairIncidents() {
  return repairFetch<{
    items: Array<{
      id: string;
      title: string;
      fingerprint: string;
      severity: string;
      count: number;
      status: string;
    }>;
  }>("/diagnostics/incidents");
}

export async function planRepair(body: {
  findingId?: string;
  scenarioId?: string;
}) {
  return repairFetch<{
    execution: {
      id: string;
      scenarioId: string;
      risk: string;
      status: string;
      dryRun: boolean;
      planJson: unknown;
    };
  }>("/repair/plan", { method: "POST", body: JSON.stringify(body) });
}

export async function executeRepair(body: {
  executionId: string;
  confirm: boolean;
  dryRun?: boolean;
  password?: string;
}) {
  return repairFetch<{
    execution: {
      id: string;
      status: string;
      risk: string;
      resultJson: unknown;
    };
  }>("/repair/execute", { method: "POST", body: JSON.stringify(body) });
}

export async function rollbackRepair(body: { executionId: string }) {
  return repairFetch<{
    id: string;
    status: string;
    rollbackJson: unknown;
  }>("/repair/rollback", { method: "POST", body: JSON.stringify(body) });
}

export async function fetchRepairIssues() {
  return repairFetch<{ items: unknown[] }>("/repair/issues");
}

export async function fetchResetScopes() {
  return repairFetch<{
    scopes: Array<{ id: string; label: string; risk: string }>;
  }>("/reset/scopes");
}

export async function previewReset(body: { scope: string }) {
  return repairFetch<{ preview: unknown }>("/reset/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchRepairReportingStatus() {
  return repairFetch<{
    queued: number;
    sent: number;
    failed: number;
  }>("/reporting/status");
}

export async function flushRepairReporting() {
  return repairFetch<{ flushed: number }>("/reporting/flush", {
    method: "POST",
    body: "{}",
  });
}

export async function fetchRepairMaintenance() {
  return repairFetch<{ status: string; notes: string[] }>("/maintenance");
}

export async function createRepairSnapshot() {
  return repairFetch<{
    id: string;
    ref: string;
    kind: string;
    restorable: boolean;
    note?: string;
  }>("/snapshots", {
    method: "POST",
    body: "{}",
  });
}

export async function fetchRepairBackups() {
  return repairFetch<{
    items: Array<{
      id: string;
      ref: string;
      kind?: string;
      restorable?: boolean;
      note?: string;
    }>;
  }>("/backups");
}

export async function fetchRecoveryPolicies() {
  return repairFetch<{
    policies: Array<{
      id: string;
      title: string;
      status: "ALLOWED" | "DEFERRED" | "REJECTED";
      reason: string;
    }>;
  }>("/recovery/policies");
}

export async function createRecoveryManifest(label?: string) {
  return repairFetch<{
    manifest: {
      id: string;
      restorable: boolean;
      modules: Array<{ moduleKey: string; status: string }>;
      note: string;
      rejectedPaths: string[];
    };
  }>("/recovery/manifest", {
    method: "POST",
    body: JSON.stringify({ label }),
  });
}

export async function verifyRepair(body: { executionId: string }) {
  return repairFetch<{ ok: boolean; detail: unknown }>("/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchRepairAudit() {
  return repairFetch<{ items: unknown[] }>("/audit");
}
