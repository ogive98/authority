import { Prisma } from '@prisma/client';
import { ProcessedEventService } from './processed-event.service';

describe('ProcessedEventService', () => {
  it('returns duplicate when the consumer already processed the event', async () => {
    const prisma = {
      coreProcessedEvent: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('duplicate', {
            code: 'P2002',
            clientVersion: 'test',
          }),
        ),
      },
    };

    const service = new ProcessedEventService(prisma as never);
    await expect(service.markProcessed('audit.tap', 'event-1')).resolves.toBe(
      'duplicate',
    );
  });

  it('returns new when the event was not processed yet', async () => {
    const prisma = {
      coreProcessedEvent: {
        create: jest.fn().mockResolvedValue({ id: 'processed-1' }),
      },
    };

    const service = new ProcessedEventService(prisma as never);
    await expect(service.markProcessed('audit.tap', 'event-1')).resolves.toBe(
      'new',
    );
  });

  it('detects already processed events', async () => {
    const prisma = {
      coreProcessedEvent: {
        findFirst: jest.fn().mockResolvedValue({ id: 'processed-1' }),
      },
    };

    const service = new ProcessedEventService(prisma as never);
    await expect(service.isProcessed('audit.tap', 'event-1')).resolves.toBe(
      true,
    );
  });

  it('prunes expired rows in batches', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
      coreProcessedEvent: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    const service = new ProcessedEventService(prisma as never);
    const result = await service.pruneExpired({
      retentionDays: 7,
      batchSize: 100,
    });
    expect(result.deleted).toBe(2);
    expect(prisma.coreProcessedEvent.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] } },
    });
  });

  it('prune returns 0 when nothing to delete', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      coreProcessedEvent: {
        deleteMany: jest.fn(),
      },
    };
    const service = new ProcessedEventService(prisma as never);
    const result = await service.pruneExpired();
    expect(result.deleted).toBe(0);
    expect(prisma.coreProcessedEvent.deleteMany).not.toHaveBeenCalled();
  });
});
