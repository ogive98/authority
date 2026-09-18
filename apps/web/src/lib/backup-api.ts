/** Client for Backup APIs (`/api/v1/backup`) — D304–D307 UI. */

const BACKUP_API = "/api/v1/backup";

async function backupFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: T | null; message?: string; code?: string }> {
  try {
    const res = await fetch(`${BACKUP_API}${path}`, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : undefined),
        ...init?.headers,
      },
      ...init,
    });
    const body = (await res.json().catch(() => null)) as
      | (T & { message?: string; code?: string })
      | null;
    if (!res.ok) {
      return {
        status: res.status,
        data: null,
        message: body?.message ?? `HTTP ${res.status}`,
        code: body?.code,
      };
    }
    return { status: res.status, data: body as T };
  } catch {
    return { status: 503, data: null, message: "API indisponible" };
  }
}

export type BackupDashboard = {
  companyId: string;
  counts: {
    total: number;
    verified: number;
    failed: number;
    locked: number;
    restorable: number;
  };
  lastBackup?: {
    id: string;
    label: string | null;
    scope: string;
    status: string;
    restorable: boolean;
    createdAt: string;
  } | null;
  lastVerified?: {
    id: string;
    label: string | null;
    scope: string;
    status: string;
    restorable: boolean;
    createdAt: string;
  } | null;
  openRestoreRequests?: number;
  schedule?: {
    autoBackup: { enabled: boolean; hourTunis: number; timezone: string };
    retention: { enabled: boolean; hourTunis: number; timezone: string };
  };
  note?: string;
};

export type BackupRow = {
  id: string;
  companyId: string;
  scope: string;
  status: string;
  restorable: boolean;
  locked: boolean;
  label: string | null;
  sizeBytes: number | null;
  checksumSha256: string | null;
  artifactPath?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt: string | null;
  manifest?: {
    applicationVersion: string;
    schemaVersion: string;
    checksumAlgorithm: string;
  } | null;
};

export type RestoreRequestRow = {
  id: string;
  companyId: string;
  backupId: string;
  status: string;
  requestedByUserId: string;
  approvedByUserId: string | null;
  secondApprovedByUserId: string | null;
  requestedAt: string;
  approvedAt: string | null;
  secondApprovedAt: string | null;
  dryValidatedAt: string | null;
  applied: boolean;
  appliedAt: string | null;
  safetyBackupId: string | null;
  healthReport: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  note?: string;
  dumpMode?: string;
  dualControlRequired?: boolean;
};

export type BackupJobRow = {
  id: string;
  companyId: string;
  type: string;
  status: string;
  backupId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type BackupDestinationRow = {
  id: string;
  companyId: string;
  type: string;
  name: string;
  pathRef: string;
  healthStatus: string;
  enabled: boolean;
};

export type BackupPolicyRow = {
  id: string;
  companyId: string;
  name: string;
  scope: string;
  type: string;
  scheduleEnabled: boolean;
  scheduleCron: string | null;
  verificationRequired: boolean;
  enabled: boolean;
};

/** Must match API `RESTORE_CONFIRM_PHRASE`. */
export const RESTORE_CONFIRM_PHRASE = "RESTORE";

export async function fetchBackupDashboard() {
  return backupFetch<BackupDashboard>("/dashboard");
}

export async function fetchBackups() {
  return backupFetch<{ backups: BackupRow[] }>("/backups");
}

export async function fetchRestoreRequests() {
  return backupFetch<{ restoreRequests: RestoreRequestRow[] }>(
    "/restore-requests",
  );
}

export async function fetchBackupJobs() {
  return backupFetch<{ jobs: BackupJobRow[] }>("/jobs");
}

export async function fetchBackupDestinations() {
  return backupFetch<{ destinations: BackupDestinationRow[] }>("/destinations");
}

export async function fetchBackupPolicies() {
  return backupFetch<{ policies: BackupPolicyRow[] }>("/policies");
}

export type BackupEffectiveSetting = {
  key: string;
  value: unknown;
  source: string;
  description: string;
};

export async function fetchBackupEffectiveSettings() {
  return backupFetch<{
    companyId: string;
    settings: BackupEffectiveSetting[];
  }>("/settings/effective");
}

export async function createBackup(body: {
  label?: string;
  scope?: "CONFIGURATION" | "DATABASE";
}) {
  return backupFetch<BackupRow>("/backups", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function verifyBackup(id: string) {
  return backupFetch<BackupRow>(`/backups/${id}/verify`, { method: "POST" });
}

export async function lockBackup(id: string) {
  return backupFetch<BackupRow>(`/backups/${id}/lock`, { method: "POST" });
}

export async function softDeleteBackup(id: string) {
  return backupFetch<{ ok: true } | BackupRow>(`/backups/${id}`, {
    method: "DELETE",
  });
}

export async function fetchBackup(id: string) {
  return backupFetch<BackupRow>(`/backups/${id}`);
}

export async function testDestination(id: string) {
  return backupFetch<{
    id: string;
    healthStatus: string;
    detail: string;
    ok: boolean;
  }>(`/destinations/${id}/test`, { method: "POST" });
}

export async function cancelRestore(id: string) {
  return backupFetch<RestoreRequestRow>(`/restore-requests/${id}/cancel`, {
    method: "POST",
  });
}

export type SpecificFoldersConfig = {
  enabled: boolean;
  defaultSelection: string[];
  allowUserSelection: boolean;
  followSymlinks: boolean;
  includePatterns: string[];
  excludePatterns: string[];
  maxSize: number;
  verifyAfterBackup: boolean;
  auto: { enabled: boolean; hourTunis: number };
  destinations: Record<
    string,
    { allowed: boolean; supported: boolean }
  >;
  sandboxRootHint: string;
  businessFolderTemplates?: string[];
  backupTypeSupported: string[];
  backupTypeUnsupported: string[];
  encryptionSupported: boolean;
};

export async function fetchSpecificFoldersConfig() {
  return backupFetch<SpecificFoldersConfig>("/specific-folders/config");
}

export async function fetchSpecificFoldersRoots(parent = "") {
  const q = parent ? `?parent=${encodeURIComponent(parent)}` : "";
  return backupFetch<{
    companyId: string;
    parent: string;
    directories: Array<{
      relativePath: string;
      name: string;
      accessible: boolean;
    }>;
  }>(`/specific-folders/roots${q}`);
}

export async function validateSpecificFolders(folders: string[]) {
  return backupFetch<{
    folders: Array<{
      relativePath: string;
      ok: boolean;
      code?: string;
      message?: string;
    }>;
  }>("/specific-folders/validate", {
    method: "POST",
    body: JSON.stringify({ folders }),
  });
}

export async function previewSpecificFolders(body: {
  folders: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
}) {
  return backupFetch<{
    filesIncluded: number;
    filesExcluded: number;
    totalSizeBytes: number;
    estimatedBackupSizeBytes: number;
    folders: string[];
  }>("/specific-folders/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createSpecificFoldersJob(body: {
  label?: string;
  folders: string[];
  destinationMode: "LOCAL_DISK" | "DOWNLOAD";
  includePatterns?: string[];
  excludePatterns?: string[];
  verifyAfterBackup?: boolean;
}) {
  return backupFetch<{
    backupId: string;
    jobId: string;
    thunderJobId: string | null;
    status: string;
    destinationMode: string;
    label: string | null;
  }>("/specific-folders/jobs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchSpecificFolderJob(jobId: string) {
  return backupFetch<{
    id: string;
    backupId: string;
    status: string;
    progress: number;
    downloadReady: boolean;
    backupStatus: string;
    errorMessage?: string | null;
  }>(`/jobs/${jobId}`);
}

export function specificFoldersDownloadHref(backupId: string) {
  return `${BACKUP_API}/backups/${backupId}/download`;
}

export async function listCompanyFiles(path = "") {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  return backupFetch<{
    companyId: string;
    path: string;
    directories: Array<{
      relativePath: string;
      name: string;
      accessible: boolean;
    }>;
    templates: string[];
    sandboxRootHint: string;
  }>(`/company-files${q}`);
}

export async function mkdirCompanyFiles(body: { path?: string; name: string }) {
  return backupFetch<{
    relativePath: string;
    name: string;
    sandboxRootHint: string;
  }>("/company-files/mkdir", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchLocalDiskResolve() {
  return backupFetch<{
    companyId: string;
    localSubpath: string;
    fromCwd: string;
    underLocalRoot: string;
    templates: string[];
  }>("/destinations/local/resolve");
}

export async function mkdirLocalDisk(body: { path?: string; name: string }) {
  return backupFetch<{
    relativePath: string;
    underLocalRoot: string;
    fromCwd: string;
    localSubpath: string;
  }>("/destinations/local/mkdir", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function requestRestore(id: string, password: string) {
  return backupFetch<RestoreRequestRow>(`/backups/${id}/restore`, {
    method: "POST",
    body: JSON.stringify({ confirm: true, password }),
  });
}

export async function approveRestore(id: string, password: string) {
  return backupFetch<RestoreRequestRow>(`/restore-requests/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function applyRestore(
  id: string,
  password: string,
  confirmPhrase: string,
) {
  return backupFetch<RestoreRequestRow>(`/restore-requests/${id}/apply`, {
    method: "POST",
    body: JSON.stringify({ password, confirmPhrase }),
  });
}

export async function runRetention() {
  return backupFetch<{
    companyId: string;
    softDeleted: number;
    skippedLocked: number;
    keepDays: number;
  }>("/retention/run", { method: "POST" });
}
