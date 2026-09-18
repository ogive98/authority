import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  companyLocalDiskRoot,
  companySandboxRoot,
  createLocalDiskDirectory,
  createSandboxDirectory,
  localDiskArtifactFromCwd,
  normalizeLocalSubpath,
  resolveLocalDiskRelative,
  resolveSandboxRelative,
} from './backup-path-security';
import { scanSpecificFolders } from './backup-folder-scan';
import { writeStreamingTarGz, sha256File } from './backup-zip.util';

describe('backup-path-security (D313/D314)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';

  it('rejects absolute and traversal paths', () => {
    assert.throws(() => resolveSandboxRelative(companyId, 'C:\\Windows'));
    assert.throws(() => resolveSandboxRelative(companyId, '/etc/passwd'));
    assert.throws(() => resolveSandboxRelative(companyId, '../outside'));
    assert.throws(() => resolveSandboxRelative(companyId, 'a/../../b'));
  });

  it('resolves relative path under sandbox', () => {
    const r = resolveSandboxRelative(companyId, 'docs/exports');
    assert.equal(r.relativePath, 'docs/exports');
    assert.ok(r.absolutePath.startsWith(companySandboxRoot(companyId)));
  });

  it('normalizes localSubpath and rejects escape', () => {
    assert.equal(normalizeLocalSubpath(''), '');
    assert.equal(normalizeLocalSubpath('archives/2026'), 'archives/2026');
    assert.throws(() => normalizeLocalSubpath('../x'));
    assert.throws(() => normalizeLocalSubpath('/abs'));
  });

  it('creates sandbox directory and rejects traversal name', async () => {
    const cid = `mkdir-sb-${Date.now()}`;
    await mkdir(companySandboxRoot(cid), { recursive: true });
    const created = await createSandboxDirectory(cid, '', 'comptabilite');
    assert.equal(created.relativePath, 'comptabilite');
    await assert.rejects(() => createSandboxDirectory(cid, '', '..'));
    await rm(companySandboxRoot(cid), { recursive: true, force: true });
  });

  it('resolves LOCAL_DISK under company + subpath', () => {
    const r = resolveLocalDiskRelative(companyId, 'nightly', 'archives');
    assert.equal(r.relativePath, 'nightly');
    assert.ok(r.underLocalRoot.includes('archives'));
    assert.ok(r.fromCwd.startsWith('data/backups/'));
    assert.ok(companyLocalDiskRoot(companyId, 'archives').includes(companyId));
  });

  it('creates LOCAL_DISK directory under subpath', async () => {
    const cid = `mkdir-ld-${Date.now()}`;
    const created = await createLocalDiskDirectory(cid, '', 'batch1', 'out');
    assert.equal(created.relativePath, 'batch1');
    assert.ok(created.fromCwd.includes('out'));
    await rm(companyLocalDiskRoot(cid, 'out'), { recursive: true, force: true });
  });

  it('builds artifact paths with subpath', () => {
    const p = localDiskArtifactFromCwd(companyId, 'b1.tar.gz', 'archives');
    assert.equal(p, `data/backups/${companyId}/archives/b1.tar.gz`);
  });
});

describe('backup-folder-scan + zip (D313)', () => {
  it('scans include/exclude and streams tar.gz checksum', async () => {
    const companyId = `c-${Date.now()}`;
    const root = companySandboxRoot(companyId);
    const docs = join(root, 'docs');
    await mkdir(docs, { recursive: true });
    await writeFile(join(docs, 'a.txt'), 'hello-authority', 'utf8');
    await writeFile(join(docs, 'skip.tmp'), 'tmp', 'utf8');

    const scan = await scanSpecificFolders({
      companyId,
      folders: ['docs'],
      excludePatterns: ['*.tmp'],
      maxSize: 10_000_000,
    });
    assert.equal(scan.filesIncluded, 1);
    assert.ok(scan.filesExcluded >= 1);

    const out = join(tmpdir(), `bck-sf-${Date.now()}.tar.gz`);
    const written = await writeStreamingTarGz({
      files: scan.files,
      outputPath: out,
    });
    assert.ok(written.sizeBytes > 0);
    const rehash = await sha256File(out);
    assert.equal(rehash, written.checksumSha256);
  });
});
