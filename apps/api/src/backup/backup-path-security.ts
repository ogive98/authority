import { access, lstat, mkdir, readdir } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import {
  BACKUP_COMPANY_FILES_ROOT,
  BACKUP_LOCAL_ROOT,
  BUSINESS_FOLDER_TEMPLATES,
} from './backup.constants';

export type ResolvedSandboxPath = {
  /** Relative path under company sandbox (posix-ish forward slashes). */
  relativePath: string;
  absolutePath: string;
  sandboxRoot: string;
};

export type ResolvedLocalDiskPath = {
  /** Relative under company LOCAL_DISK root (posix). */
  relativePath: string;
  absolutePath: string;
  companyRoot: string;
  /** Path from process.cwd() including BACKUP_LOCAL_ROOT. */
  fromCwd: string;
  /** Path under BACKUP_LOCAL_ROOT (companyId[/subpath][/rel]). */
  underLocalRoot: string;
};

function toPosixRelative(rel: string): string {
  return rel.split(sep).join('/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function assertSafeRelativeSegments(trimmed: string): void {
  if (trimmed.includes('\0')) {
    throw Object.assign(new Error('Null byte in path'), {
      code: 'PATH_TRAVERSAL',
    });
  }
  if (
    isAbsolute(trimmed) ||
    /^[a-zA-Z]:/.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('\\') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('\\\\')
  ) {
    throw Object.assign(new Error('Absolute paths are not allowed'), {
      code: 'PATH_FORBIDDEN',
    });
  }
  if (trimmed.split('/').some((p) => p === '..' || p === '')) {
    throw Object.assign(new Error('Path traversal rejected'), {
      code: 'PATH_TRAVERSAL',
    });
  }
}

/** Normalize slashes but keep leading `/` or drive letter for absolute checks. */
function toForwardSlashes(input: string): string {
  return input.trim().replace(/\\/g, '/');
}

/**
 * Normalize Prefs `backup.destination.localSubpath`.
 * Empty string = company root under data/backups/{companyId}/.
 */
export function normalizeLocalSubpath(input: unknown): string {
  if (input == null || input === '') return '';
  if (typeof input !== 'string') {
    throw Object.assign(new Error('localSubpath must be a string'), {
      code: 'PATH_FORBIDDEN',
    });
  }
  const raw = toForwardSlashes(input);
  assertSafeRelativeSegments(raw);
  const trimmed = raw.replace(/^\/+|\/+$/g, '');
  if (!trimmed || trimmed === '.') return '';
  assertSafeRelativeSegments(trimmed);
  return toPosixRelative(trimmed);
}

/** Suggested empty business folders (not auto-seeded). */
export function businessFolderTemplates(): readonly string[] {
  return BUSINESS_FOLDER_TEMPLATES;
}

/** Absolute sandbox root for a company (created on demand). */
export function companySandboxRoot(companyId: string): string {
  return resolve(process.cwd(), BACKUP_COMPANY_FILES_ROOT, companyId);
}

export async function ensureCompanySandbox(companyId: string): Promise<string> {
  const root = companySandboxRoot(companyId);
  await mkdir(root, { recursive: true });
  return root;
}

/**
 * Resolve a user-supplied relative path under the company sandbox.
 * Blocks absolute paths, traversal, null bytes, and escapes.
 */
export function resolveSandboxRelative(
  companyId: string,
  inputPath: string,
): ResolvedSandboxPath {
  if (!inputPath || typeof inputPath !== 'string') {
    throw Object.assign(new Error('Path required'), { code: 'PATH_FORBIDDEN' });
  }
  const raw = toForwardSlashes(inputPath);
  if (!raw || raw === '.' || raw === './') {
    return {
      relativePath: '',
      absolutePath: companySandboxRoot(companyId),
      sandboxRoot: companySandboxRoot(companyId),
    };
  }
  assertSafeRelativeSegments(raw);
  const trimmed = raw.replace(/^\/+|\/+$/g, '');
  if (!trimmed || trimmed === '.') {
    return {
      relativePath: '',
      absolutePath: companySandboxRoot(companyId),
      sandboxRoot: companySandboxRoot(companyId),
    };
  }
  assertSafeRelativeSegments(trimmed);

  const sandboxRoot = companySandboxRoot(companyId);
  const candidate = resolve(sandboxRoot, normalize(trimmed));
  const rel = relative(sandboxRoot, candidate);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw Object.assign(new Error('Path escapes company sandbox'), {
      code: 'PATH_TRAVERSAL',
    });
  }

  return {
    relativePath: toPosixRelative(rel),
    absolutePath: candidate,
    sandboxRoot,
  };
}

export async function assertReadableDirectory(
  resolved: ResolvedSandboxPath,
  opts?: { followSymlinks?: boolean },
): Promise<{ exists: boolean; isDirectory: boolean; readable: boolean }> {
  try {
    const st = await lstat(resolved.absolutePath);
    if (st.isSymbolicLink() && !opts?.followSymlinks) {
      return { exists: true, isDirectory: false, readable: false };
    }
    if (!st.isDirectory()) {
      return { exists: true, isDirectory: false, readable: false };
    }
    await access(resolved.absolutePath, fsConstants.R_OK);
    return { exists: true, isDirectory: true, readable: true };
  } catch {
    return { exists: false, isDirectory: false, readable: false };
  }
}

/** List immediate child directories under a relative sandbox path (default root). */
export async function listSandboxDirectories(
  companyId: string,
  relativeParent = '',
): Promise<
  Array<{
    relativePath: string;
    name: string;
    accessible: boolean;
  }>
> {
  await ensureCompanySandbox(companyId);
  const parent = resolveSandboxRelative(companyId, relativeParent || '.');
  const entries = await readdir(parent.absolutePath, { withFileTypes: true });
  const out: Array<{
    relativePath: string;
    name: string;
    accessible: boolean;
  }> = [];
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.isSymbolicLink()) continue;
    const childRel = parent.relativePath
      ? `${parent.relativePath}/${ent.name}`
      : ent.name;
    const resolved = resolveSandboxRelative(companyId, childRel);
    const accessInfo = await assertReadableDirectory(resolved, {
      followSymlinks: false,
    });
    out.push({
      relativePath: resolved.relativePath,
      name: ent.name,
      accessible: accessInfo.readable,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const FOLDER_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function assertFolderName(name: string): string {
  const trimmed = name.trim();
  if (!FOLDER_NAME_RE.test(trimmed) || trimmed.includes('..')) {
    throw Object.assign(new Error('Invalid folder name'), {
      code: 'PATH_FORBIDDEN',
    });
  }
  return trimmed;
}

/** Create a directory under the company sandbox (relative parent + name). */
export async function createSandboxDirectory(
  companyId: string,
  parentRel: string,
  name: string,
): Promise<ResolvedSandboxPath> {
  await ensureCompanySandbox(companyId);
  const folderName = assertFolderName(name);
  const parent = resolveSandboxRelative(companyId, parentRel || '.');
  const childRel = parent.relativePath
    ? `${parent.relativePath}/${folderName}`
    : folderName;
  const resolved = resolveSandboxRelative(companyId, childRel);
  await mkdir(resolved.absolutePath, { recursive: false });
  return resolved;
}

/** Absolute LOCAL_DISK root for a company (+ optional Prefs subpath). */
export function companyLocalDiskRoot(
  companyId: string,
  localSubpath = '',
): string {
  const sub = normalizeLocalSubpath(localSubpath);
  if (!sub) {
    return resolve(process.cwd(), BACKUP_LOCAL_ROOT, companyId);
  }
  return resolve(process.cwd(), BACKUP_LOCAL_ROOT, companyId, ...sub.split('/'));
}

export async function ensureCompanyLocalDisk(
  companyId: string,
  localSubpath = '',
): Promise<string> {
  const root = companyLocalDiskRoot(companyId, localSubpath);
  await mkdir(root, { recursive: true });
  return root;
}

/**
 * Resolve a relative path under company LOCAL_DISK root
 * (`data/backups/{companyId}/{localSubpath}/…`).
 */
export function resolveLocalDiskRelative(
  companyId: string,
  inputPath: string,
  localSubpath = '',
): ResolvedLocalDiskPath {
  const companyRoot = companyLocalDiskRoot(companyId, localSubpath);
  const sub = normalizeLocalSubpath(localSubpath);
  const underCompanyPrefix = sub ? `${companyId}/${sub}` : companyId;

  if (!inputPath || typeof inputPath !== 'string') {
    throw Object.assign(new Error('Path required'), { code: 'PATH_FORBIDDEN' });
  }
  const raw = toForwardSlashes(inputPath);
  if (!raw || raw === '.' || raw === './') {
    return {
      relativePath: '',
      absolutePath: companyRoot,
      companyRoot,
      fromCwd: toPosixRelative(join(BACKUP_LOCAL_ROOT, underCompanyPrefix)),
      underLocalRoot: underCompanyPrefix,
    };
  }
  assertSafeRelativeSegments(raw);
  const trimmed = raw.replace(/^\/+|\/+$/g, '');
  if (!trimmed || trimmed === '.') {
    return {
      relativePath: '',
      absolutePath: companyRoot,
      companyRoot,
      fromCwd: toPosixRelative(join(BACKUP_LOCAL_ROOT, underCompanyPrefix)),
      underLocalRoot: underCompanyPrefix,
    };
  }
  assertSafeRelativeSegments(trimmed);

  const candidate = resolve(companyRoot, normalize(trimmed));
  const rel = relative(companyRoot, candidate);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw Object.assign(new Error('Path escapes LOCAL_DISK root'), {
      code: 'PATH_TRAVERSAL',
    });
  }
  const relativePath = toPosixRelative(rel);
  const underLocalRoot = relativePath
    ? `${underCompanyPrefix}/${relativePath}`
    : underCompanyPrefix;
  return {
    relativePath,
    absolutePath: candidate,
    companyRoot,
    fromCwd: toPosixRelative(join(BACKUP_LOCAL_ROOT, underLocalRoot)),
    underLocalRoot,
  };
}

/** Create a directory under company LOCAL_DISK (+ Prefs subpath). */
export async function createLocalDiskDirectory(
  companyId: string,
  parentRel: string,
  name: string,
  localSubpath = '',
): Promise<ResolvedLocalDiskPath> {
  await ensureCompanyLocalDisk(companyId, localSubpath);
  const folderName = assertFolderName(name);
  const parent = resolveLocalDiskRelative(
    companyId,
    parentRel || '.',
    localSubpath,
  );
  const childRel = parent.relativePath
    ? `${parent.relativePath}/${folderName}`
    : folderName;
  const resolved = resolveLocalDiskRelative(companyId, childRel, localSubpath);
  await mkdir(resolved.absolutePath, { recursive: false });
  return resolved;
}

/**
 * Artifact path under BACKUP_LOCAL_ROOT:
 * `{companyId}/{localSubpath}/{fileName}`.
 */
export function localDiskArtifactUnderRoot(
  companyId: string,
  fileName: string,
  localSubpath = '',
): string {
  const base = fileName.trim().replace(/\\/g, '/');
  if (!base || base.includes('..') || base.includes('/') || base.includes('\0')) {
    throw Object.assign(new Error('Invalid artifact file name'), {
      code: 'PATH_FORBIDDEN',
    });
  }
  const sub = normalizeLocalSubpath(localSubpath);
  return sub
    ? toPosixRelative(join(companyId, sub, base))
    : toPosixRelative(join(companyId, base));
}

/** Full from-cwd path for streaming artifacts (SPECIFIC_FOLDERS style). */
export function localDiskArtifactFromCwd(
  companyId: string,
  fileName: string,
  localSubpath = '',
): string {
  return toPosixRelative(
    join(
      BACKUP_LOCAL_ROOT,
      localDiskArtifactUnderRoot(companyId, fileName, localSubpath),
    ),
  );
}
