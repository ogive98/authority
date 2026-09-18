import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { BACKUP_LOCAL_ROOT } from './backup.constants';
import {
  applyLogicalCompanyDump,
  detectDumpMode,
} from './backup-restore.util';

describe('backup-restore.util (D307)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const dir = join(process.cwd(), BACKUP_LOCAL_ROOT, companyId);
  const dumpPath = join(dir, 'test-logical.dump');

  beforeAll(async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(
      dumpPath,
      JSON.stringify({
        format: 'authority.logical_dump.v1',
        companyId,
        modules: [{ moduleKey: 'backup', status: 'ENABLED' }],
        settings: [],
        files: [],
      }),
      'utf8',
    );
  });

  it('detects logical_company dump mode', async () => {
    const mode = await detectDumpMode({ artifactAbsolutePath: dumpPath });
    expect(mode).toBe('logical_company');
  });

  it('applies logical dump and reports health', async () => {
    const prisma = {
      modModuleState: {
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1),
      },
      setDef: { findUnique: jest.fn().mockResolvedValue(null) },
      setValue: { upsert: jest.fn() },
      orgCompany: {
        findUnique: jest.fn().mockResolvedValue({
          id: companyId,
          code: 'DEMO',
          deletedAt: null,
        }),
      },
      bckBackup: { count: jest.fn().mockResolvedValue(1) },
    };

    const result = await applyLogicalCompanyDump({
      prisma: prisma as never,
      companyId,
      artifactAbsolutePath: dumpPath,
    });

    expect(result.dumpMode).toBe('logical_company');
    expect(result.modulesUpserted).toBe(1);
    expect(result.health.ok).toBe(true);
    expect(prisma.modModuleState.upsert).toHaveBeenCalled();
  });
});
