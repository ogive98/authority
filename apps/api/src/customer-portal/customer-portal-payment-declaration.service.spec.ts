import { HttpStatus } from '@nestjs/common';
import {
  FinOpenItemSide,
  FinPaymentMethod,
  PtlPaymentDeclarationStatus,
} from '@prisma/client';
import { CUSTOMER_PORTAL_ERROR_CODES } from './customer-portal.constants';
import { CustomerPortalException } from './customer-portal.exception';
import { CustomerPortalPaymentDeclarationService } from './customer-portal-payment-declaration.service';

describe('CustomerPortalPaymentDeclarationService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const customerId = '33333333-3333-3333-3333-333333333333';
  const userId = '55555555-5555-5555-5555-555555555555';
  const declarationId = '77777777-7777-7777-7777-777777777777';

  function row(overrides: Record<string, unknown> = {}) {
    return {
      id: declarationId,
      companyId,
      customerId,
      number: 'PPD-2026-0001',
      amount: { toFixed: (n: number) => (120.5).toFixed(n) },
      currency: 'TND',
      method: FinPaymentMethod.BANK_TRANSFER,
      paymentDate: new Date('2026-09-14'),
      reference: 'VIR-1',
      notes: null,
      openItemId: null,
      status: PtlPaymentDeclarationStatus.SUBMITTED,
      version: 0,
      createdAt: new Date('2026-09-14T10:00:00.000Z'),
      updatedAt: new Date('2026-09-14T10:00:00.000Z'),
      reviewedAt: null,
      reviewNote: null,
      createdByUserId: userId,
      ...overrides,
    };
  }

  function build(opts?: { existing?: ReturnType<typeof row> | null }) {
    const created = row();
    const prisma = {
      finOpenItem: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      ptlPaymentDeclaration: {
        findMany: jest.fn().mockResolvedValue([created]),
        findFirst: jest
          .fn()
          .mockResolvedValue(opts?.existing === undefined ? created : opts.existing),
        create: jest.fn().mockResolvedValue(created),
        update: jest.fn().mockResolvedValue(
          row({ status: PtlPaymentDeclarationStatus.CANCELLED, version: 1 }),
        ),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          ptlPaymentDeclaration: {
            create: jest.fn().mockResolvedValue(created),
            update: jest.fn().mockResolvedValue(
              row({ status: PtlPaymentDeclarationStatus.CANCELLED, version: 1 }),
            ),
          },
        }),
      ),
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const service = new CustomerPortalPaymentDeclarationService(
      prisma as never,
      outbox as never,
    );
    return { service, prisma, outbox, created };
  }

  it('creates SUBMITTED declaration without FinPayment', async () => {
    const { service, outbox } = build();
    const dto = await service.create(companyId, customerId, userId, {
      amount: 120.5,
      method: FinPaymentMethod.BANK_TRANSFER,
      paymentDate: '2026-09-14',
      reference: 'VIR-1',
    });
    expect(dto.status).toBe(PtlPaymentDeclarationStatus.SUBMITTED);
    expect(dto.amount).toBe('120.500');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'portals.payment_declaration.submitted.v1',
      }),
    );
  });

  it('rejects non-positive amount', async () => {
    const { service } = build();
    await expect(
      service.create(companyId, customerId, userId, {
        amount: 0,
        method: FinPaymentMethod.CASH,
        paymentDate: '2026-09-14',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: CUSTOMER_PORTAL_ERROR_CODES.VALIDATION,
      }),
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('cancels only SUBMITTED', async () => {
    const { service } = build({
      existing: row({ status: PtlPaymentDeclarationStatus.ACKNOWLEDGED }),
    });
    await expect(
      service.cancel(companyId, customerId, declarationId),
    ).rejects.toBeInstanceOf(CustomerPortalException);
  });

  it('validates optional open item ownership', async () => {
    const { service, prisma } = build();
    prisma.finOpenItem.findFirst.mockResolvedValue({
      id: '88888888-8888-8888-8888-888888888888',
      side: FinOpenItemSide.AR,
    });
    const dto = await service.create(companyId, customerId, userId, {
      amount: 10,
      method: FinPaymentMethod.CASH,
      paymentDate: '2026-09-14',
      openItemId: '88888888-8888-8888-8888-888888888888',
    });
    expect(dto.status).toBe(PtlPaymentDeclarationStatus.SUBMITTED);
    expect(prisma.finOpenItem.findFirst).toHaveBeenCalled();
  });
});
