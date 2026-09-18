import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { mkdir, readFile, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import type { PrismaService } from '../prisma/prisma.service';
import { BACKUP_LOCAL_ROOT } from './backup.constants';

export type DumpMode = 'pg_dump' | 'logical_company';

export interface InstallableArtifactResult {
  dumpMode: DumpMode;
  /** Relative path under BACKUP_LOCAL_ROOT (primary dump). */
  artifactRelativePath: string;
  inventoryRelativePath: string;
  manifestRelativePath: string;
  checksumSha256: string;
  sizeBytes: bigint;
  restorable: true;
  applicationVersion: string;
  schemaVersion: string;
  moduleVersions: Record<string, string>;
  scopeMetadata: Record<string, unknown>;
}

/**
 * Build an installable DATABASE backup under LOCAL_FS.
 * Prefers `pg_dump`; falls back to a company-scoped logical JSON dump (honest, no secrets logged).
 * File inventory comes from CoreFile rows (MinIO keys) — not destination secrets.
 */
export async function buildInstallableDatabaseArtifact(input: {
  prisma: PrismaService;
  companyId: string;
  backupId: string;
  /** Prefs backup.destination.localSubpath (relative under company). */
  localSubpath?: string;
}): Promise<InstallableArtifactResult> {
  const sub = input.localSubpath?.trim() || '';
  const companyDir = sub
    ? join(process.cwd(), BACKUP_LOCAL_ROOT, input.companyId, ...sub.split('/'))
    : join(process.cwd(), BACKUP_LOCAL_ROOT, input.companyId);
  await mkdir(companyDir, { recursive: true });

  const dumpFileName = `${input.backupId}.dump`;
  const dumpAbsolute = join(companyDir, dumpFileName);
  const dumpRelative = sub
    ? join(input.companyId, sub, dumpFileName)
    : join(input.companyId, dumpFileName);

  let dumpMode: DumpMode = 'pg_dump';
  try {
    await runPgDump(dumpAbsolute);
  } catch {
    dumpMode = 'logical_company';
    await writeLogicalCompanyDump(input.prisma, input.companyId, dumpAbsolute);
  }

  const underCompany = (file: string) =>
    sub ? join(input.companyId, sub, file) : join(input.companyId, file);

  const inventoryRelative = underCompany(`${input.backupId}.files.json`);
  const inventoryAbsolute = join(
    process.cwd(),
    BACKUP_LOCAL_ROOT,
    inventoryRelative,
  );
  const inventory = await buildFileInventory(input.prisma, input.companyId);
  await writeFile(
    inventoryAbsolute,
    JSON.stringify(inventory, null, 2),
    'utf8',
  );

  const moduleStates = await input.prisma.modModuleState.findMany({
    where: { companyId: input.companyId },
    orderBy: { moduleKey: 'asc' },
  });
  const moduleVersions: Record<string, string> = {};
  for (const row of moduleStates) {
    moduleVersions[row.moduleKey] = row.status;
  }

  const applicationVersion = process.env.npm_package_version ?? '0.0.0';
  const schemaVersion = 'd305';
  const dumpStat = await stat(dumpAbsolute);
  const dumpChecksum = createHash('sha256')
    .update(await readFile(dumpAbsolute))
    .digest('hex');

  const scopeMetadata = {
    scope: 'DATABASE',
    kind: 'installable-dump',
    dumpMode,
    dumpPath: dumpRelative,
    inventoryPath: inventoryRelative,
    fileCount: inventory.files.length,
    restorable: true,
    note: 'D305 installable artifact — live restore apply deferred to D307',
  };

  const manifestBody = {
    backupId: input.backupId,
    companyId: input.companyId,
    scope: 'DATABASE',
    kind: 'installable-dump',
    restorable: true,
    applicationVersion,
    schemaVersion,
    moduleVersions,
    dumpMode,
    dumpPath: dumpRelative,
    inventoryPath: inventoryRelative,
    dumpChecksumSha256: dumpChecksum,
    createdAt: new Date().toISOString(),
    note: scopeMetadata.note,
  };

  const manifestRelative = underCompany(`${input.backupId}.manifest.json`);
  const manifestAbsolute = join(
    process.cwd(),
    BACKUP_LOCAL_ROOT,
    manifestRelative,
  );
  const manifestRaw = JSON.stringify(manifestBody, null, 2);
  await writeFile(manifestAbsolute, manifestRaw, 'utf8');
  const checksumSha256 = createHash('sha256')
    .update(manifestRaw)
    .digest('hex');

  return {
    dumpMode,
    artifactRelativePath: dumpRelative,
    inventoryRelativePath: inventoryRelative,
    manifestRelativePath: manifestRelative,
    checksumSha256,
    sizeBytes: BigInt(dumpStat.size),
    restorable: true,
    applicationVersion,
    schemaVersion,
    moduleVersions,
    scopeMetadata,
  };
}

async function runPgDump(targetAbsolute: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL missing');
  }

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      'pg_dump',
      [
        `--dbname=${databaseUrl}`,
        '--format=custom',
        '--no-owner',
        '--no-acl',
        `--file=${targetAbsolute}`,
      ],
      { env: process.env, stdio: ['ignore', 'ignore', 'pipe'] },
    );

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `pg_dump exited ${code}`));
      }
    });
  });
}

async function writeLogicalCompanyDump(
  prisma: PrismaService,
  companyId: string,
  targetAbsolute: string,
): Promise<void> {
  const [company, modules, settings, files] = await Promise.all([
    prisma.orgCompany.findUnique({ where: { id: companyId } }),
    prisma.modModuleState.findMany({
      where: { companyId },
      orderBy: { moduleKey: 'asc' },
    }),
    prisma.setValue.findMany({
      where: { companyId, deletedAt: null },
      take: 5000,
      orderBy: { defKey: 'asc' },
      select: {
        defKey: true,
        level: true,
        scopeKey: true,
        valueJson: true,
      },
    }),
    prisma.coreFile.findMany({
      where: { companyId, deletedAt: null },
      take: 10_000,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        bucket: true,
        key: true,
        mime: true,
        size: true,
        checksum: true,
      },
    }),
  ]);

  const body = {
    format: 'authority.logical_dump.v1',
    companyId,
    createdAt: new Date().toISOString(),
    company: company
      ? {
          id: company.id,
          code: company.code,
          legalName: company.legalName,
          country: company.country,
          currency: company.currency,
          timezone: company.timezone,
          status: company.status,
        }
      : null,
    modules: modules.map((row) => ({
      moduleKey: row.moduleKey,
      status: row.status,
    })),
    settings: settings.map((row) => ({
      key: row.defKey,
      setLevel: row.level,
      scopeKey: row.scopeKey,
      valueJson: row.valueJson,
    })),
    files: files.map((row) => ({
      id: row.id,
      bucket: row.bucket,
      key: row.key,
      mime: row.mime,
      size: row.size.toString(),
      checksum: row.checksum,
    })),
    note: 'Logical company dump used when pg_dump is unavailable',
  };

  await writeFile(targetAbsolute, JSON.stringify(body, null, 2), 'utf8');
}

async function buildFileInventory(
  prisma: PrismaService,
  companyId: string,
): Promise<{
  companyId: string;
  source: 'core_file';
  generatedAt: string;
  files: Array<{
    id: string;
    bucket: string;
    key: string;
    mime: string;
    size: string;
    checksum: string | null;
  }>;
}> {
  const files = await prisma.coreFile.findMany({
    where: { companyId, deletedAt: null },
    take: 10_000,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      bucket: true,
      key: true,
      mime: true,
      size: true,
      checksum: true,
    },
  });
  return {
    companyId,
    source: 'core_file',
    generatedAt: new Date().toISOString(),
    files: files.map((row) => ({
      id: row.id,
      bucket: row.bucket,
      key: row.key,
      mime: row.mime,
      size: row.size.toString(),
      checksum: row.checksum,
    })),
  };
}

/** Dry-validate an installable dump without mutating the live DB. */
export async function dryValidateInstallableArtifact(input: {
  artifactAbsolutePath: string;
  expectedChecksum?: string | null;
}): Promise<{ ok: true; dumpMode: DumpMode | 'unknown' }> {
  const bytes = await readFile(input.artifactAbsolutePath);
  if (bytes.byteLength < 16) {
    throw new Error('Dump artifact too small');
  }

  if (input.expectedChecksum) {
    const checksum = createHash('sha256').update(bytes).digest('hex');
    if (checksum !== input.expectedChecksum) {
      throw new Error('Dump checksum mismatch');
    }
  }

  const head = bytes.subarray(0, 5).toString('utf8');
  if (head === 'PGDMP') {
    return { ok: true, dumpMode: 'pg_dump' };
  }

  try {
    const parsed = JSON.parse(bytes.toString('utf8')) as {
      format?: string;
    };
    if (parsed.format === 'authority.logical_dump.v1') {
      return { ok: true, dumpMode: 'logical_company' };
    }
  } catch {
    // fall through
  }

  throw new Error('Unrecognized dump artifact format');
}
