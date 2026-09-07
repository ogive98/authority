import { ThunderException } from '../thunder.exception';
import { RecommendationService } from './recommendation.service';

describe('RecommendationService', () => {
  const prisma = {
    thuRecommendation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const audit = {
    append: jest.fn(),
  };

  let service: RecommendationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RecommendationService(prisma as never, audit as never);
  });

  it('creates a recommendation', async () => {
    const row = { id: 'rec-1', status: 'OPEN' };
    prisma.thuRecommendation.create.mockResolvedValue(row);

    const result = await service.create({
      companyId: 'co-1',
      problem: 'Shipment failed',
      evidence: {},
      options: [{ id: 'review' }],
      proposedAction: { type: 'record_only' },
      correlationId: 'corr-1',
    });

    expect(result).toEqual(row);
  });

  it('applies with audit and no silent domain mutation', async () => {
    const open = {
      id: 'rec-1',
      companyId: 'co-1',
      status: 'OPEN',
      proposedAction: { type: 'record_only' },
      correlationId: 'corr-1',
    };
    prisma.thuRecommendation.findFirst.mockResolvedValue(open);
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        thuRecommendation: {
          update: jest.fn().mockResolvedValue({ ...open, status: 'APPLIED' }),
        },
      };
      return fn(tx);
    });

    const result = await service.apply('co-1', 'rec-1', 'user-1');
    expect(result.status).toBe('APPLIED');
    expect(audit.append).toHaveBeenCalled();
  });

  it('rejects apply when already applied', async () => {
    prisma.thuRecommendation.findFirst.mockResolvedValue({
      id: 'rec-1',
      companyId: 'co-1',
      status: 'APPLIED',
    });

    await expect(
      service.apply('co-1', 'rec-1', 'user-1'),
    ).rejects.toBeInstanceOf(ThunderException);
  });
});
