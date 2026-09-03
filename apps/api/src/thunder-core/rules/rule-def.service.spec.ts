import { HttpStatus } from '@nestjs/common';
import { RuleDefService } from './rule-def.service';
import { THUNDER_RULE_ERROR_CODES } from './rule.types';
import { ThunderException } from '../thunder.exception';

describe('RuleDefService', () => {
  const prisma = {
    thunderRuleDef: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  let service: RuleDefService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RuleDefService(prisma as never);
  });

  it('rejects cyclic rules at save', async () => {
    prisma.thunderRuleDef.findMany.mockResolvedValue([
      {
        id: 'r1',
        companyId: null,
        moduleKey: 'platform',
        name: 'a-to-b',
        enabled: true,
        priority: 100,
        eventPattern: 'event.a.v1',
        conditionsJson: { '==': [1, 1] },
        actionsJson: [
          {
            type: 'enqueue_job',
            jobType: 'thunder.hello.v1',
            queue: 'ops',
            emitsEventType: 'event.b.v1',
          },
        ],
      },
    ]);

    try {
      await service.create({
        moduleKey: 'platform',
        name: 'b-to-a',
        enabled: true,
        priority: 100,
        eventPattern: 'event.b.v1',
        conditions: { '==': [1, 1] },
        actions: [
          {
            type: 'enqueue_job',
            jobType: 'thunder.hello.v1',
            queue: 'ops',
            emitsEventType: 'event.a.v1',
          },
        ],
      });
      fail('expected cycle rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ThunderException);
      expect((error as ThunderException).code).toBe(
        THUNDER_RULE_ERROR_CODES.CYCLE_DETECTED,
      );
      expect((error as ThunderException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
    expect(prisma.thunderRuleDef.create).not.toHaveBeenCalled();
  });

  it('rejects non-whitelist actions', async () => {
    prisma.thunderRuleDef.findMany.mockResolvedValue([]);

    try {
      await service.create({
        moduleKey: 'platform',
        name: 'bad',
        enabled: true,
        priority: 100,
        eventPattern: 'event.x.v1',
        conditions: { '==': [1, 1] },
        actions: [{ type: 'call_module_command' } as never],
      });
      fail('expected invalid action rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ThunderException);
      expect((error as ThunderException).code).toBe(
        THUNDER_RULE_ERROR_CODES.INVALID_ACTION,
      );
      expect((error as ThunderException).getStatus()).toBe(
        HttpStatus.BAD_REQUEST,
      );
    }
  });
});
