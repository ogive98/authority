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
});
