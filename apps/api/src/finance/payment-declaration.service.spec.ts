import { HttpStatus } from '@nestjs/common';
import {
  FinPaymentMethod,
  PtlPaymentDeclarationStatus,
} from '@prisma/client';
import { FINANCE_ERROR_CODES } from './finance.constants';
import { PaymentDeclarationService } from './payment-declaration.service';

describe('PaymentDeclarationService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const customerId = '33333333-3333-3333-3333-333333333333';
  const reviewerId = '55555555-5555-5555-5555-555555555555';
  const declarationId = '77777777-7777-7777-7777-777777777777';

  function row(overrides: Record<string, unknown> = {}) {
    return {
      id: declarationId,
      companyId,
      customerId,
      number: 'PPD-2026-0001',
      amount: { toFixed: (n: number) => (50).toFixed(n) },
      currency: 'TND',
      method: FinPaymentMethod.BANK_TRANSFER,
      paymentDate: new Date('2026-09-14'),
      reference: null,
      notes: null,
      openItemId: null,
      status: PtlPaymentDeclarationStatus.SUBMITTED,
      version: 0,
      createdAt: new Date('2026-09-14T10:00:00.000Z'),
      updatedAt: new Date('2026-09-14T10:00:00.000Z'),
      reviewedAt: null,
      reviewNote: null,
      createdByUserId: reviewerId,
      ...overrides,
    };
  }

  function build(existing = row()) {
    const acknowledged = row({
      status: PtlPaymentDeclarationStatus.ACKNOWLEDGED,
      version: 1,
      reviewedAt: new Date('2026-09-14T12:00:00.000Z'),
      reviewNote: 'OK',
    });
    const prisma = {
      ptlPaymentDeclaration: {
        findMany: jest.fn().mockResolvedValue([existing]),
        findFirst: jest.fn().mockResolvedValue(existing),
        findUniqueOrThrow: jest.fn().mockResolvedValue(acknowledged),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      cusCustomer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: customerId,
            code: 'C-001',
            party: { legalName: 'Client Demo' },
          },
        ]),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          ptlPaymentDeclaration: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: jest.fn().mockResolvedValue(acknowledged),
          },
        }),
      ),
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const service = new PaymentDeclarationService(
      prisma as never,
      outbox as never,
    );
    return { service, prisma, outbox, acknowledged };
  }

  it('acknowledges SUBMITTED without creating FinPayment', async () => {
    const { service, outbox } = build();
    const dto = await service.acknowledge(companyId, declarationId, reviewerId, {
      version: 0,
      reviewNote: 'OK',
    });
    expect(dto.status).toBe(PtlPaymentDeclarationStatus.ACKNOWLEDGED);
    expect(dto.customerCode).toBe('C-001');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'finance.payment_declaration.acknowledged.v1',
      }),
    );
  });

  it('rejects review when not SUBMITTED', async () => {
    const { service } = build(
      row({ status: PtlPaymentDeclarationStatus.CANCELLED }),
    );
    await expect(
      service.reject(companyId, declarationId, reviewerId, { version: 0 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: FINANCE_ERROR_CODES.INVALID_STATUS,
      }),
      status: HttpStatus.CONFLICT,
    });
  });

  it('conflicts on version mismatch', async () => {
    const { service } = build();
    await expect(
      service.acknowledge(companyId, declarationId, reviewerId, {
        version: 9,
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
    });
  });
});
