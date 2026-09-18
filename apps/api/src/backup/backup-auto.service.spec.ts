import { BackupAutoService } from './backup-auto.service';

describe('BackupAutoService', () => {
  const prisma = {
    setValue: {
      findFirst: jest.fn(),
    },
  };
  const backup = {
    createBackup: jest.fn(),
  };

  const service = new BackupAutoService(prisma as never, backup as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults autoBackup disabled + hour 2 + DATABASE scope', async () => {
    prisma.setValue.findFirst.mockResolvedValue(null);
    await expect(service.isAutoBackupEnabled('c1')).resolves.toBe(false);
    await expect(service.resolveAutoHour('c1')).resolves.toBe(2);
    await expect(service.resolveAutoScope('c1')).resolves.toBe('DATABASE');
  });

  it('reads company overrides', async () => {
    prisma.setValue.findFirst
      .mockResolvedValueOnce({ valueJson: true })
      .mockResolvedValueOnce({ valueJson: 5 })
      .mockResolvedValueOnce({ valueJson: 'CONFIGURATION' });
    await expect(service.isAutoBackupEnabled('c1')).resolves.toBe(true);
    await expect(service.resolveAutoHour('c1')).resolves.toBe(5);
    await expect(service.resolveAutoScope('c1')).resolves.toBe('CONFIGURATION');
  });

  it('runScheduledCreate refuses when disabled', async () => {
    prisma.setValue.findFirst.mockResolvedValue({ valueJson: false });
    await expect(service.runScheduledCreate('c1')).rejects.toThrow(
      /disabled/i,
    );
    expect(backup.createBackup).not.toHaveBeenCalled();
  });

  it('runScheduledCreate calls BackupService without actor UUID', async () => {
    prisma.setValue.findFirst
      .mockResolvedValueOnce({ valueJson: true }) // enabled
      .mockResolvedValueOnce({ valueJson: 'DATABASE' }); // scope
    backup.createBackup.mockResolvedValue({
      id: 'b1',
      scope: 'DATABASE',
      restorable: true,
      label: 'auto-database-2026-09-18',
    });
    const result = await service.runScheduledCreate('c1', {
      correlationId: 'corr',
    });
    expect(backup.createBackup).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'c1',
        actorUserId: undefined,
        scope: 'DATABASE',
        correlationId: 'corr',
      }),
    );
    expect(result.backupId).toBe('b1');
  });
});
