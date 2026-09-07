import { ThunderException } from '../thunder.exception';
import { SignalService } from './signal.service';

describe('SignalService', () => {
  const prisma = {
    thuSignal: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: SignalService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SignalService(prisma as never);
  });

  it('creates a signal', async () => {
    const row = {
      id: 'sig-1',
      companyId: 'co-1',
      type: 'DeliveryFailed',
      status: 'OPEN',
    };
    prisma.thuSignal.create.mockResolvedValue(row);

    const result = await service.create({
      companyId: 'co-1',
      type: 'DeliveryFailed',
      source: 'thunder.intel',
      sourceEventId: 'evt-1',
      correlationId: 'corr-1',
      evidence: { ok: true },
    });

    expect(result).toEqual(row);
    expect(prisma.thuSignal.create).toHaveBeenCalled();
  });

  it('returns existing signal on same source event', async () => {
    const existing = { id: 'sig-1', companyId: 'co-1', type: 'DeliveryFailed' };
    prisma.thuSignal.findUnique.mockResolvedValue(existing);

    const result = await service.create({
      companyId: 'co-1',
      type: 'DeliveryFailed',
      source: 'thunder.intel',
      sourceEventId: 'evt-1',
      correlationId: 'corr-1',
      evidence: {},
    });

    expect(result).toEqual(existing);
    expect(prisma.thuSignal.create).not.toHaveBeenCalled();
  });

  it('acks open signal', async () => {
    prisma.thuSignal.findFirst.mockResolvedValue({
      id: 'sig-1',
      companyId: 'co-1',
      status: 'OPEN',
    });
    prisma.thuSignal.update.mockResolvedValue({
      id: 'sig-1',
      status: 'ACK',
    });

    const result = await service.ack('co-1', 'sig-1');
    expect(result.status).toBe('ACK');
  });

  it('throws when signal missing', async () => {
    prisma.thuSignal.findFirst.mockResolvedValue(null);
    await expect(service.ack('co-1', 'missing')).rejects.toBeInstanceOf(
      ThunderException,
    );
  });
});
