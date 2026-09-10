import { FinPaymentStatus } from '@prisma/client';
import { PaymentService } from './payment.service';

describe('PaymentService.reverse (D187)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const paymentId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const openItemId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const customerId = '22222222-2222-2222-2222-222222222222';

  it('restores AR, marks REVERSED, emits payment.reversed', async () => {
    const now = new Date();
    const payment = {
      id: paymentId,
      companyId,
      customerId,
      number: 'PAY-1',
      status: FinPaymentStatus.POSTED,
      amount: { toFixed: () => '100.000', toString: () => '100' },
      amountUnallocated: { toFixed: () => '0.000' },
      currency: 'TND',
      method: 'CASH',
      paymentDate: now,
      accountingDate: now,
      reference: null,
      notes: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const reversed = {
      ...payment,
      status: FinPaymentStatus.REVERSED,
      amountUnallocated: { toFixed: () => '100.000' },
      instruments: [],
      allocations: [],
    };
    const prisma: Record<string, unknown> = {
      finPayment: {
        findFirst: jest.fn().mockResolvedValue(payment),
        update: jest.fn().mockResolvedValue(null),
        findFirstOrThrow: jest.fn().mockResolvedValue(reversed),
      },
      finAllocation: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'alloc-1', openItemId, amount: 100, paymentId },
        ]),
        delete: jest.fn().mockResolvedValue(null),
      },
      finOpenItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: openItemId,
          amountOpen: 0,
          amountTotal: 100,
        }),
        update: jest.fn().mockResolvedValue(null),
      },
      finPaymentInstrument: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      cusCustomer: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const service = new PaymentService(
      prisma as never,
      outbox as never,
      { confirm: jest.fn() } as never,
      { markKeptForClosedOpenItem: jest.fn() } as never,
    );

    const dto = await service.reverse(companyId, paymentId);
    expect(dto.status).toBe(FinPaymentStatus.REVERSED);
    expect(prisma.finOpenItem.update).toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: 'finance.payment.reversed.v1',
        payloadJson: expect.objectContaining({ paymentId }),
      }),
    );
  });
});
