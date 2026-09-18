import { BackupRetentionService } from './backup-retention.service';

describe('BackupRetentionService (D306)', () => {
  let prisma: {
    setValue: { findFirst: jest.Mock };
    bckBackup: { findMany: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: { append: jest.Mock };
  let outboxService: { enqueue: jest.Mock };
  let service: BackupRetentionService;

  beforeEach(() => {
    prisma = {
      setValue: { findFirst: jest.fn().mockResolvedValue(null) },
      bckBackup: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'old-1', locked: false, createdAt: new Date('2020-01-01') },
          { id: 'locked-1', locked: true, createdAt: new Date('2020-01-01') },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) =>
        cb(prisma),
      ),
    };
    auditService = { append: jest.fn().mockResolvedValue({ id: 'a1' }) };
    outboxService = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    service = new BackupRetentionService(
      prisma as never,
      auditService as never,
      outboxService as never,
    );
  });

  it('no-ops when retention disabled and not forced', async () => {
    const result = await service.runRetention('c1');
    expect(result.enabled).toBe(false);
    expect(result.softDeleted).toBe(0);
    expect(prisma.bckBackup.findMany).not.toHaveBeenCalled();
  });

  it('soft-deletes unlocked expired backups and skips locked', async () => {
    const result = await service.runRetention('c1', {
      force: true,
      actorUserId: 'u1',
    });
    expect(result.enabled).toBe(true);
    expect(result.softDeleted).toBe(1);
    expect(result.skippedLocked).toBe(1);
    expect(result.backupIds).toEqual(['old-1']);
    expect(prisma.bckBackup.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'old-1' } }),
    );
    expect(outboxService.enqueue).toHaveBeenCalled();
  });
});
