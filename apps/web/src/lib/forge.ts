type ApiFail = { ok: false; status: number; code?: string; message: string };

async function parseFail(res: Response): Promise<ApiFail> {
  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
  };
  return {
    ok: false,
    status: res.status,
    code: body.code,
    message: body.message ?? res.statusText,
  };
}

export type ForgeExtensionStatus =
  | "DRAFT"
  | "ANALYZING"
  | "GENERATING"
  | "VALIDATING"
  | "TESTING"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "ACTIVE"
  | "SUSPENDED"
  | "DISABLED"
  | "FAILED"
  | "ARCHIVED";

export type ForgeFeatureRequestStatus =
  | "RECEIVED"
  | "ANALYZING"
  | "PLANNED"
  | "WAITING_APPROVAL"
  | "IMPLEMENTING"
  | "TESTING"
  | "READY"
  | "DEPLOYED"
  | "REJECTED"
  | "FAILED";

export type ForgeExtension = {
  id: string;
  companyId: string;
  key: string;
  name: string;
  description: string | null;
  manifestVersion: string;
  status: ForgeExtensionStatus;
  tenantScope: string;
  dependencies: string[];
  compatibleCoreVersion: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ForgeFeatureRequest = {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  status: ForgeFeatureRequestStatus;
  priority: number;
  source: string;
  extensionId: string | null;
  affectedModules: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ForgeOverview = {
  extensions: { total: number; byStatus: Record<string, number> };
  featureRequests: { total: number; byStatus: Record<string, number> };
  metadata?: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    activeWithCommandId: number;
  };
  phase: string;
  ai: "UNAVAILABLE" | string;
  sandbox: "UNAVAILABLE" | string;
};

export type ForgeMetadataType =
  | "entity"
  | "field"
  | "action"
  | "view"
  | "form"
  | "table"
  | "workflow"
  | "report"
  | "automation";

export type ForgeMetadataStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type ForgeMetadataDefinition = {
  id: string;
  companyId: string;
  key: string;
  type: ForgeMetadataType;
  moduleKey: string;
  extensionId: string | null;
  schemaJson: Record<string, unknown>;
  status: ForgeMetadataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export const FORGE_METADATA_STATUS_LABELS: Record<ForgeMetadataStatus, string> =
  {
    DRAFT: "Brouillon",
    ACTIVE: "Active",
    ARCHIVED: "Archivée",
  };

export const FORGE_METADATA_TYPE_LABELS: Record<ForgeMetadataType, string> = {
  entity: "Entité",
  field: "Champ",
  action: "Action",
  view: "Vue",
  form: "Formulaire",
  table: "Table",
  workflow: "Workflow",
  report: "Rapport",
  automation: "Automatisation",
};

export const FORGE_EXTENSION_STATUS_LABELS: Record<
  ForgeExtensionStatus,
  string
> = {
  DRAFT: "Brouillon",
  ANALYZING: "Analyse",
  GENERATING: "Génération",
  VALIDATING: "Validation",
  TESTING: "Tests",
  READY_FOR_REVIEW: "Revue",
  APPROVED: "Approuvée",
  ACTIVE: "Active",
  SUSPENDED: "Suspendue",
  DISABLED: "Désactivée",
  FAILED: "Échec",
  ARCHIVED: "Archivée",
};

export const FORGE_FR_STATUS_LABELS: Record<ForgeFeatureRequestStatus, string> =
  {
    RECEIVED: "Reçue",
    ANALYZING: "Analyse",
    PLANNED: "Planifiée",
    WAITING_APPROVAL: "Approbation",
    IMPLEMENTING: "Implémentation",
    TESTING: "Tests",
    READY: "Prête",
    DEPLOYED: "Déployée",
    REJECTED: "Rejetée",
    FAILED: "Échec",
  };

export function forgeExtBadgeTone(
  status: ForgeExtensionStatus,
): "success" | "warning" | "neutral" | "danger" | "accent" {
  if (status === "ACTIVE") return "success";
  if (status === "APPROVED" || status === "READY_FOR_REVIEW") return "accent";
  if (status === "FAILED") return "danger";
  if (status === "DRAFT" || status === "ANALYZING") return "warning";
  return "neutral";
}

export async function fetchForgeOverview(): Promise<
  { ok: true; data: ForgeOverview } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/forge/overview", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ForgeOverview };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchForgeExtensions(): Promise<
  { ok: true; data: { items: ForgeExtension[] } } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/forge/extensions", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: ForgeExtension[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function registerForgeExtension(body: {
  key: string;
  name: string;
  description?: string;
  manifestVersion: string;
}): Promise<{ ok: true; data: ForgeExtension } | ApiFail> {
  try {
    const res = await fetch("/api/v1/forge/extensions", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ForgeExtension };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function transitionForgeExtension(
  id: string,
  status: ForgeExtensionStatus,
): Promise<{ ok: true; data: ForgeExtension } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/forge/extensions/${id}/transition`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ForgeExtension };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function approveForgeExtension(
  id: string,
): Promise<{ ok: true; data: ForgeExtension } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/forge/extensions/${id}/approve`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ForgeExtension };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function activateForgeExtension(
  id: string,
): Promise<{ ok: true; data: ForgeExtension } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/forge/extensions/${id}/activate`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ForgeExtension };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchForgeFeatureRequests(): Promise<
  { ok: true; data: { items: ForgeFeatureRequest[] } } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/forge/feature-requests", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: ForgeFeatureRequest[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createForgeFeatureRequest(body: {
  title: string;
  description?: string;
  priority?: number;
}): Promise<{ ok: true; data: ForgeFeatureRequest } | ApiFail> {
  try {
    const res = await fetch("/api/v1/forge/feature-requests", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ForgeFeatureRequest };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchForgeMetadata(): Promise<
  { ok: true; data: { items: ForgeMetadataDefinition[] } } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/forge/metadata", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: ForgeMetadataDefinition[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchForgeMetadataBridge(): Promise<
  { ok: true; data: { items: ForgeMetadataDefinition[] } } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/forge/metadata/bridge", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: ForgeMetadataDefinition[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createForgeMetadata(body: {
  key: string;
  type: ForgeMetadataType;
  moduleKey: string;
  schemaJson?: Record<string, unknown>;
  extensionId?: string;
}): Promise<{ ok: true; data: ForgeMetadataDefinition } | ApiFail> {
  try {
    const res = await fetch("/api/v1/forge/metadata", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ForgeMetadataDefinition };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function transitionForgeMetadata(
  id: string,
  status: ForgeMetadataStatus,
): Promise<{ ok: true; data: ForgeMetadataDefinition } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/forge/metadata/${id}/transition`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ForgeMetadataDefinition };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}
