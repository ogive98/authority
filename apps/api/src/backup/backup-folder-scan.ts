import { createReadStream } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import {
  assertReadableDirectory,
  resolveSandboxRelative,
  type ResolvedSandboxPath,
} from './backup-path-security';

export type ScannedFile = {
  /** Path inside archive / relative to sandbox. */
  archivePath: string;
  absolutePath: string;
  sizeBytes: number;
};

export type FolderScanResult = {
  files: ScannedFile[];
  filesIncluded: number;
  filesExcluded: number;
  totalSizeBytes: number;
  folders: string[];
};

function matchGlob(name: string, pattern: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  // Simple glob: *, **, path segments — not full micromatch.
  const escaped = p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*');
  const re = new RegExp(`^${escaped}$`, 'i');
  return re.test(name.replace(/\\/g, '/'));
}

function isExcluded(
  relPosix: string,
  include: string[],
  exclude: string[],
): boolean {
  const base = relPosix.split('/').pop() ?? relPosix;
  for (const ex of exclude) {
    if (matchGlob(relPosix, ex) || matchGlob(base, ex)) return true;
    // directory name match
    if (relPosix.split('/').some((seg) => matchGlob(seg, ex))) return true;
  }
  if (include.length === 0) return false;
  return !include.some(
    (inc) => matchGlob(relPosix, inc) || matchGlob(base, inc),
  );
}

async function walkDir(
  absDir: string,
  sandboxRoot: string,
  followSymlinks: boolean,
  include: string[],
  exclude: string[],
  acc: FolderScanResult,
  maxSize: number,
): Promise<void> {
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const ent of entries) {
    const abs = join(absDir, ent.name);
    let st;
    try {
      st = await lstat(abs);
    } catch {
      acc.filesExcluded += 1;
      continue;
    }
    if (st.isSymbolicLink() && !followSymlinks) {
      acc.filesExcluded += 1;
      continue;
    }
    const rel = relative(sandboxRoot, abs);
    if (rel.startsWith('..')) continue;
    const relPosix = rel.split(sep).join('/');

    if (st.isDirectory()) {
      if (isExcluded(relPosix, include, exclude)) {
        acc.filesExcluded += 1;
        continue;
      }
      await walkDir(
        abs,
        sandboxRoot,
        followSymlinks,
        include,
        exclude,
        acc,
        maxSize,
      );
      continue;
    }
    if (!st.isFile()) {
      acc.filesExcluded += 1;
      continue;
    }
    if (isExcluded(relPosix, include, exclude)) {
      acc.filesExcluded += 1;
      continue;
    }
    acc.totalSizeBytes += st.size;
    if (acc.totalSizeBytes > maxSize) {
      throw Object.assign(new Error('Selection exceeds maxSize'), {
        code: 'MAX_SIZE_EXCEEDED',
        totalSizeBytes: acc.totalSizeBytes,
        maxSize,
      });
    }
    acc.files.push({
      archivePath: relPosix,
      absolutePath: abs,
      sizeBytes: st.size,
    });
    acc.filesIncluded += 1;
  }
}

export async function scanSpecificFolders(input: {
  companyId: string;
  folders: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
  followSymlinks?: boolean;
  maxSize: number;
}): Promise<FolderScanResult> {
  const include = (input.includePatterns ?? []).filter(Boolean);
  const exclude = (input.excludePatterns ?? []).filter(Boolean);
  const follow = Boolean(input.followSymlinks);
  const acc: FolderScanResult = {
    files: [],
    filesIncluded: 0,
    filesExcluded: 0,
    totalSizeBytes: 0,
    folders: [],
  };

  for (const folder of input.folders) {
    const resolved: ResolvedSandboxPath = resolveSandboxRelative(
      input.companyId,
      folder,
    );
    const access = await assertReadableDirectory(resolved, {
      followSymlinks: follow,
    });
    if (!access.exists) {
      throw Object.assign(new Error(`Folder not found: ${folder}`), {
        code: 'PATH_NOT_FOUND',
      });
    }
    if (!access.isDirectory || !access.readable) {
      throw Object.assign(new Error(`Folder not readable: ${folder}`), {
        code: 'PATH_FORBIDDEN',
      });
    }
    acc.folders.push(resolved.relativePath || '.');
    await walkDir(
      resolved.absolutePath,
      resolved.sandboxRoot,
      follow,
      include,
      exclude,
      acc,
      input.maxSize,
    );
  }

  return acc;
}

/** Open file streams lazily for zip writer. */
export function openScannedFileStream(file: ScannedFile) {
  return createReadStream(file.absolutePath);
}
