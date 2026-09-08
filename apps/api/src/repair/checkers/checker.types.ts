import type { ScanDepthId } from '../catalogs/scan-levels.catalog';

export type RawFindingSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface RawFinding {
  component: string;
  category: string;
  severity: RawFindingSeverity;
  confidence: string;
  evidenceSummary: string;
  evidenceFingerprint: string;
  signatureCandidate?: string;
}

/** Domain axis B (REPAIR_MODE) — lowercase keys for matching. */
export type CheckerDomain =
  | 'runtime'
  | 'kernel'
  | 'module'
  | 'data'
  | 'connectors'
  | 'licence'
  | 'license';

export interface RepairCheckerDef {
  id: string;
  /** Scan depths that include this checker. */
  depths: readonly ScanDepthId[];
  /** Domain tags (axis B). Empty = always eligible when depth matches. */
  domains: readonly string[];
  run: () => Promise<RawFinding[]>;
}

/** Expand UI domain ids (L0–L5) to checker tags. */
export const DOMAIN_TAG_ALIASES: Readonly<Record<string, readonly string[]>> = {
  l0: ['l0', 'runtime', 'postgres', 'database', 'redis'],
  runtime: ['l0', 'runtime', 'postgres', 'database', 'redis'],
  l1: ['l1', 'kernel', 'thunder', 'outbox'],
  kernel: ['l1', 'kernel', 'thunder', 'outbox'],
  thunder: ['l1', 'kernel', 'thunder', 'outbox'],
  l2: ['l2', 'module', 'catalog'],
  module: ['l2', 'module', 'catalog'],
  catalog: ['l2', 'module', 'catalog'],
  l3: ['l3', 'data', 'database', 'postgres'],
  data: ['l3', 'data', 'database', 'postgres'],
  l4: ['l4', 'connectors', 'redis'],
  connectors: ['l4', 'connectors', 'redis'],
  l5: ['l5', 'licence', 'license'],
  licence: ['l5', 'licence', 'license'],
  license: ['l5', 'licence', 'license'],
};

export function expandDomainTags(domains: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const d of domains) {
    const key = d.toLowerCase();
    out.add(key);
    for (const alias of DOMAIN_TAG_ALIASES[key] ?? []) {
      out.add(alias);
    }
  }
  return out;
}
