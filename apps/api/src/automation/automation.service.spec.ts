import { HttpStatus } from '@nestjs/common';
import {
  AtmActionKind,
  AtmProfileMode,
  AtmRunStatus,
  AtmTriggerKind,
} from '@prisma/client';
import { AUTOMATION_ERROR_CODES } from './automation.constants';
import { AutomationService } from './automation.service';

describe('AutomationService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const profileId = '22222222-2222-2222-2222-222222222222';
  const userId = '33333333-3333-3333-3333-333333333333';

  function profile(overrides: Record<string, unknown> = {}) {
    return {
      id: profileId,
      companyId,
      code: 'OVERDUE_HINT',
      name: 'Relances échues',
      description: null,
      mode: AtmProfileMode.ASSISTED,
      triggerKind: AtmTriggerKind.FINANCE_OVERDUE_OPEN_ITEMS,
      actionKind: AtmActionKind.PREPARE_DUNNING_HINT,
      enabled: true,
      shadowMode: false,
      configJson: {},
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  function build() {
    const row = profile();
    const run = {
      id: '44444444-4444-4444-4444-444444444444',
      companyId,
      profileId,
      number: 'ATM-2026-0001',
      status: AtmRunStatus.SUGGESTED,
      triggerRef: null,
      summary: '2 créance(s) AR échue(s)',
      payloadJson: { overdueCount: 2 },
      resultJson: { noMutation: true },
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      reviewedAt: null,
      reviewNote: null,
      createdByUserId: userId,
      profile: { code: row.code, name: row.name },
    };
    const prisma = {
      atmProfile: {
        findMany: jest.fn().mockResolvedValue([row]),
        findFirst: jest.fn().mockResolvedValue(row),
        findUniqueOrThrow: jest.fn().mockResolvedValue(row),
        create: jest.fn().mockResolvedValue(row),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      atmRunLog: {
        findMany: jest.fn().mockResolvedValue([run]),
        findFirst: jest.fn().mockResolvedValue(run),
        findUniqueOrThrow: jest.fn().mockResolvedValue(run),
        create: jest.fn().mockResolvedValue(run),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      finOpenItem: { count: jest.fn().mockResolvedValue(2) },
      ptlPaymentDeclaration: { count: jest.fn().mockResolvedValue(0) },
      salOrder: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          atmProfile: {
            create: jest.fn().mockResolvedValue(row),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: jest.fn().mockResolvedValue(row),
          },
          atmRunLog: {
            create: jest.fn().mockResolvedValue(run),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              ...run,
              status: AtmRunStatus.APPROVED,
              version: 1,
            }),
          },
        }),
      ),
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const service = new AutomationService(prisma as never, outbox as never);
    return { service, prisma, outbox };
  }

  it('rejects FULL_AUTO mode', async () => {
    const { service } = build();
    await expect(
      service.createProfile(companyId, {
        code: 'FULL',
        name: 'Bad',
        mode: AtmProfileMode.FULL_AUTO,
        triggerKind: AtmTriggerKind.FINANCE_OVERDUE_OPEN_ITEMS,
        actionKind: AtmActionKind.NOTIFY,
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { code: AUTOMATION_ERROR_CODES.FULL_AUTO_FORBIDDEN },
    });
  });

  it('runs ASSISTED profile as SUGGESTED without mutations', async () => {
    const { service, outbox } = build();
    const dto = await service.runProfile(companyId, profileId, userId);
    expect(dto.status).toBe(AtmRunStatus.SUGGESTED);
    expect(dto.resultJson.noMutation).toBe(true);
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('catalog marks FULL_AUTO as not allowed', () => {
    const { service } = build();
    const cat = service.catalog();
    expect(cat.modes.find((m) => m.id === AtmProfileMode.FULL_AUTO)?.allowed).toBe(
      false,
    );
  });
});
