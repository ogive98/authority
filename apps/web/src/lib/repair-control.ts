/** Repair Thunder Shield UI — Utility Cube (ERP `/repair`). */

export type RepairRisk =
  | "SAFE"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "BLOCKED"
  | "NONE";

export type RepairStageId =
  | "scan"
  | "finding"
  | "signature"
  | "recommend"
  | "risk"
  | "plan"
  | "approve"
  | "snapshot"
  | "execute"
  | "verify"
  | "rollback"
  | "audit"
  | "report";

export type RepairStage = {
  id: RepairStageId;
  label: string;
  short: string;
  hint: string;
  detail: string;
  risk: RepairRisk;
  icon:
    | "radar"
    | "search"
    | "fingerprint"
    | "lightbulb"
    | "shield"
    | "map"
    | "check"
    | "camera"
    | "play"
    | "badge"
    | "undo"
    | "scroll"
    | "upload";
};

export type ScanDepth = "L0" | "L1" | "L2" | "L3" | "L4";
export type RepairDomain = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";

export const SCAN_DEPTHS: Array<{
  id: ScanDepth;
  label: string;
  hint: string;
  duration: string;
}> = [
  { id: "L0", label: "Instant", hint: "Liveness", duration: "< 30 s" },
  { id: "L1", label: "Quick", hint: "Operational", duration: "5–15 s" },
  { id: "L2", label: "Deep", hint: "Structural", duration: "15–45 s" },
  { id: "L3", label: "Integrity", hint: "Forensic", duration: "30–90 s" },
  {
    id: "L4",
    label: "Full audit",
    hint: "Authority slice",
    duration: "1–3 min",
  },
];

export const REPAIR_DOMAINS: Array<{
  id: RepairDomain;
  label: string;
  hint: string;
}> = [
  { id: "L0", label: "Runtime", hint: "Postgres · Redis · workers" },
  { id: "L1", label: "Kernel", hint: "Outbox · DLQ · breakers" },
  { id: "L2", label: "Module", hint: "Manifest · consumers" },
  { id: "L3", label: "Data", hint: "Scripts module only" },
  { id: "L4", label: "Connectors", hint: "Adapters · webhooks" },
  { id: "L5", label: "Licence", hint: "Entitlements · Control" },
];

export const REPAIR_PIPELINE: RepairStage[] = [
  {
    id: "scan",
    label: "Scan",
    short: "01",
    hint: "Collectors allowlistés",
    detail:
      "Lance les health checkers selon profondeur × domaines. Aucune mutation.",
    risk: "NONE",
    icon: "radar",
  },
  {
    id: "finding",
    label: "Finding",
    short: "02",
    hint: "Preuves fingerprintées",
    detail:
      "Chaque anomalie devient un finding versionné (sévérité, confiance, evidence).",
    risk: "NONE",
    icon: "search",
  },
  {
    id: "signature",
    label: "Signature",
    short: "03",
    hint: "Registry d’erreurs",
    detail:
      "Matching déterministe contre le catalogue de signatures. Sinon → UNKNOWN.",
    risk: "NONE",
    icon: "fingerprint",
  },
  {
    id: "recommend",
    label: "Reco",
    short: "04",
    hint: "Scénario connu",
    detail:
      "Propose un scénario du registry. Pas d’invention si aucun match fiable.",
    risk: "LOW",
    icon: "lightbulb",
  },
  {
    id: "risk",
    label: "Risk",
    short: "05",
    hint: "SAFE → BLOCKED",
    detail:
      "Classe le risque. BLOCKED = mutation métier, SQL arbitraire, FLUSHALL…",
    risk: "MEDIUM",
    icon: "shield",
  },
  {
    id: "plan",
    label: "Plan",
    short: "06",
    hint: "Prérequis · impact",
    detail:
      "Plan explicite : prerequisites, backup, executor, verify, rollback.",
    risk: "MEDIUM",
    icon: "map",
  },
  {
    id: "approve",
    label: "Approval",
    short: "07",
    hint: "IAM + confirm",
    detail:
      "HIGH exige re-auth. Aucun bypass SPECTRE. Dry-run avant apply destructif.",
    risk: "HIGH",
    icon: "check",
  },
  {
    id: "snapshot",
    label: "Snapshot",
    short: "08",
    hint: "Point de restore",
    detail: "Snapshot/backup si le scénario l’exige (REQUIRED pour migrations).",
    risk: "LOW",
    icon: "camera",
  },
  {
    id: "execute",
    label: "Execute",
    short: "09",
    hint: "Executor allowlist",
    detail:
      "Exécute uniquement des actions enregistrées. Pas de remote code.",
    risk: "HIGH",
    icon: "play",
  },
  {
    id: "verify",
    label: "Verify",
    short: "10",
    hint: "Post-check",
    detail: "Vérifie le critère déclaré (heartbeat, namespace vide, health…).",
    risk: "LOW",
    icon: "badge",
  },
  {
    id: "rollback",
    label: "Rollback",
    short: "11",
    hint: "Si défini",
    detail: "Rollback conditionnel si verify échoue et scénario le permet.",
    risk: "MEDIUM",
    icon: "undo",
  },
  {
    id: "audit",
    label: "Audit",
    short: "12",
    hint: "aud_event",
    detail: "Chaque étape sensible → audit + correlationId.",
    risk: "NONE",
    icon: "scroll",
  },
  {
    id: "report",
    label: "Report",
    short: "13",
    hint: "Central / local",
    detail:
      "Rapport sanitisé (pas de secrets / métier). Outbox non bloquant.",
    risk: "NONE",
    icon: "upload",
  },
];

export function repairHealthScore(opts: {
  health?: string | null;
  openFindings: number;
  openIncidents: number;
}): number {
  let score = 100;
  score -= Math.min(40, opts.openFindings * 4);
  score -= Math.min(25, opts.openIncidents * 5);
  if (opts.health === "degraded") score = Math.min(score, 78);
  if (opts.health === "ok" && opts.openFindings === 0) {
    score = Math.max(score, 94);
  }
  return Math.max(12, Math.min(100, Math.round(score)));
}

export function repairRiskTone(
  risk: RepairRisk,
): "success" | "info" | "warning" | "danger" | "neutral" {
  if (risk === "SAFE" || risk === "NONE") return "success";
  if (risk === "LOW") return "info";
  if (risk === "MEDIUM") return "warning";
  if (risk === "HIGH" || risk === "BLOCKED") return "danger";
  return "neutral";
}

export function repairRiskLabel(risk: RepairRisk): string {
  if (risk === "NONE") return "Info";
  return risk;
}

export function severityTone(
  severity: string,
): "success" | "info" | "warning" | "danger" | "neutral" {
  const s = severity.toUpperCase();
  if (s === "INFO") return "info";
  if (s === "WARN") return "warning";
  if (s === "ERROR" || s === "CRITICAL") return "danger";
  return "neutral";
}
