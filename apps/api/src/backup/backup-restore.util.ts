import { readFile } from 'fs/promises';
import { ModModuleStatus, Prisma, SetLevel } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import {
  dryValidateInstallableArtifact,
  type DumpMode,
} from './backup-dump.util';

export interface LogicalDumpV1 {
  format: 'authority.logical_dump.v1';
  companyId: string;
  modules?: Array<{ moduleKey: string; status: string }>;
  settings?: Array<{
    key: string;
    setLevel: string;
    scopeKey: string;
    valueJson: Prisma.JsonValue;
  }>;
  files?: Array<{
    id: string;
    bucket: string;
    key: string;
    mime: string;
    size: string;
    checksum: string | null;
  }>;
}

export interface RestoreHealthReport {
  ok: boolean;
  checkedAt: string;
  dumpMode: DumpMode | 'unknown';
  checks: Array<{
    id: string;
    ok: boolean;
    detail?: string;
  }>;
}

export interface LogicalApplyResult {
  dumpMode: 'logical_company';
  modulesUpserted: number;
  settingsUpserted: number;
  filesNoted: number;
  health: RestoreHealthReport;
}

export async function detectDumpMode(input: {
  artifactAbsolutePath: string;
  expectedChecksum?: string | null;
}): Promise<DumpMode | 'unknown'> {
  const result = await dryValidateInstallableArtifact(input);
  return result.dumpMode;
}

/**
 * Apply company-scoped logical dump (D307).
 * Never runs cluster pg_restore — that stays blocked on shared DB.
 */
export async function applyLogicalCompanyDump(input: {
  prisma: PrismaService;
  companyId: string;
  artifactAbsolutePath: string;
  expectedChecksum?: string | null;
}): Promise<LogicalApplyResult> {
  const validation = await dryValidateInstallableArtifact({
    artifactAbsolutePath: input.artifactAbsolutePath,
    expectedChecksum: input.expectedChecksum,
  });
  if (validation.dumpMode !== 'logical_company') {
    throw new Error(`Unsupported dump mode for live apply: ${validation.dumpMode}`);
  }

  const parsed = JSON.parse(
    await readFile(input.artifactAbsolutePath, 'utf8'),
  ) as LogicalDumpV1;
  if (parsed.format !== 'authority.logical_dump.v1') {
    throw new Error('Invalid logical dump format');
  }
  if (parsed.companyId !== input.companyId) {
    throw new Error('Dump companyId does not match tenancy companyId');
  }

  let modulesUpserted = 0;
  for (const row of parsed.modules ?? []) {
    const status = normalizeModuleStatus(row.status);
    await input.prisma.modModuleState.upsert({
      where: {
        companyId_moduleKey: {
          companyId: input.companyId,
          moduleKey: row.moduleKey,
        },
      },
      update: { status },
      create: {
        companyId: input.companyId,
        moduleKey: row.moduleKey,
        status,
      },
    });
    modulesUpserted += 1;
  }

  let settingsUpserted = 0;
  for (const row of parsed.settings ?? []) {
    if (!row.key || !row.scopeKey) continue;
    const def = await input.prisma.setDef.findUnique({
      where: { key: row.key },
    });
    if (!def) continue;
    const level = normalizeSetLevel(row.setLevel);
    await input.prisma.setValue.upsert({
      where: {
        defKey_scopeKey: {
          defKey: row.key,
          scopeKey: row.scopeKey,
        },
      },
      update: {
        valueJson: row.valueJson as Prisma.InputJsonValue,
        level,
        companyId: input.companyId,
        deletedAt: null,
        version: { increment: 1 },
      },
      create: {
        defKey: row.key,
        scopeKey: row.scopeKey,
        level,
        companyId: input.companyId,
        valueJson: row.valueJson as Prisma.InputJsonValue,
      },
    });
    settingsUpserted += 1;
  }

  const filesNoted = parsed.files?.length ?? 0;
  const health = await runPostRestoreHealthCheck({
    prisma: input.prisma,
    companyId: input.companyId,
    dumpMode: 'logical_company',
    artifactAbsolutePath: input.artifactAbsolutePath,
    expectedChecksum: input.expectedChecksum,
  });

  return {
    dumpMode: 'logical_company',
    modulesUpserted,
    settingsUpserted,
    filesNoted,
    health,
  };
}

export async function runPostRestoreHealthCheck(input: {
  prisma: PrismaService;
  companyId: string;
  dumpMode: DumpMode | 'unknown';
  artifactAbsolutePath: string;
  expectedChecksum?: string | null;
}): Promise<RestoreHealthReport> {
  const checks: RestoreHealthReport['checks'] = [];

  const company = await input.prisma.orgCompany.findUnique({
    where: { id: input.companyId },
  });
  checks.push({
    id: 'company.exists',
    ok: Boolean(company && !company.deletedAt),
    detail: company?.code,
  });

  const moduleCount = await input.prisma.modModuleState.count({
    where: { companyId: input.companyId },
  });
  checks.push({
    id: 'modules.readable',
    ok: moduleCount >= 0,
    detail: `count=${moduleCount}`,
  });

  const backupCount = await input.prisma.bckBackup.count({
    where: { companyId: input.companyId, deletedAt: null },
  });
  checks.push({
    id: 'backups.readable',
    ok: backupCount >= 0,
    detail: `count=${backupCount}`,
  });

  try {
    await dryValidateInstallableArtifact({
      artifactAbsolutePath: input.artifactAbsolutePath,
      expectedChecksum: input.expectedChecksum,
    });
    checks.push({ id: 'source.artifact.intact', ok: true });
  } catch (error) {
    checks.push({
      id: 'source.artifact.intact',
      ok: false,
      detail: error instanceof Error ? error.message : 'artifact invalid',
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    checkedAt: new Date().toISOString(),
    dumpMode: input.dumpMode,
    checks,
  };
}

function normalizeModuleStatus(raw: string): ModModuleStatus {
  if ((Object.values(ModModuleStatus) as string[]).includes(raw)) {
    return raw as ModModuleStatus;
  }
  return ModModuleStatus.DISABLED;
}

function normalizeSetLevel(raw: string): SetLevel {
  if ((Object.values(SetLevel) as string[]).includes(raw)) {
    return raw as SetLevel;
  }
  return SetLevel.COMPANY;
}
