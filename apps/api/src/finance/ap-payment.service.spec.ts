import { HttpStatus } from '@nestjs/common';
import { ApPaymentService, assertPositiveApAmount } from './ap-payment.service';
import { FINANCE_ERROR_CODES } from './finance.constants';
import { FinanceException } from './finance.exception';

describe('assertPositiveApAmount', () => {
  it('accepts a positive TND amount', () => {
    expect(() => assertPositiveApAmount(12.5)).not.toThrow();
  });

  it('rejects zero and negative', () => {
    for (const n of [0, -1, Number.NaN]) {
      try {
        assertPositiveApAmount(n);
        fail(`expected throw for ${n}`);
      } catch (error) {
        expect(error).toBeInstanceOf(FinanceException);
        const ex = error as FinanceException;
        expect(ex.code).toBe(FINANCE_ERROR_CODES.INVALID_AMOUNT);
        expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    }
  });
});

describe('ApPaymentService RAS auto (D264/D283)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const billId = '22222222-2222-2222-2222-222222222222';

  function build(opts?: {
    ras?: { applied: boolean; amount: number; rateBps: number | null };
  }) {
    const created: Record<string, unknown> = {
      id: 'pay-1',
      companyId,
      number: 'AP-2026-0001',
      vendorName: 'Fournisseur',
      amount: 950,
      amountRas: 50,
      rasRateBps: 500,
      rasApplied: true,
      currency: 'TND',
      method: 'BANK_TRANSFER',
      status: 'POSTED',
      paymentDate: new Date('2026-09-15'),
      accountingDate: new Date('2026-09-15'),
      reference: null,
      notes: null,
      apBillId: billId,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      bankMatches: [],
      apBill: { number: 'APB-1' },
    };

    const prisma = {
      finApBill: {
        findFirst: jest.fn().mockResolvedValue({
          id: billId,
          vendorName: 'Fournisseur',
          status: 'POSTED',
          supplierId: null,
        }),
      },
      finApPayment: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          Object.assign(created, data, {
            bankMatches: [],
            apBill: { number: 'APB-1' },
          });
          return Promise.resolve(created);
        }),
      },
      taxWithholding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const expertise = {
      previewRas: jest.fn().mockResolvedValue(
        opts?.ras ?? { applied: true, amount: 50, rateBps: 500, ras: {} },
      ),
    };
    const ras = {
      createFromApPayment: jest.fn().mockResolvedValue({ id: 'wh-1' }),
    };
    const service = new ApPaymentService(
      prisma as never,
      outbox as never,
      expertise as never,
      ras as never,
    );
    return { service, prisma, expertise, created, outbox, ras };
  }

  it('deducts RAS when Prefs VALIDATED (net stored in amount)', async () => {
    const { service, prisma, expertise, created, outbox, ras } = build();
    const dto = await service.create(companyId, {
      apBillId: billId,
      amount: 1000,
      method: 'BANK_TRANSFER' as never,
      paymentDate: '2026-09-15',
    });
    expect(expertise.previewRas).toHaveBeenCalledWith(companyId, 1000);
    expect(prisma.finApPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 950,
          amountRas: 50,
          rasRateBps: 500,
          rasApplied: true,
        }),
      }),
    );
    expect(dto.amount).toBe('950.000');
    expect(dto.amountRas).toBe('50.000');
    expect(dto.amountGross).toBe('1000.000');
    expect(dto.rasApplied).toBe(true);
    expect(dto.taxWithholdingId).toBe('wh-1');
    expect(created.amount).toBe(950);
    expect(ras.createFromApPayment).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        apPaymentId: 'pay-1',
        baseAmount: 1000,
        withholdingAmount: 50,
        netPayable: 950,
      }),
      prisma,
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        payloadJson: expect.objectContaining({
          amount: '950.000',
          amountRas: '50.000',
          rasApplied: true,
        }),
      }),
    );
  });

  it('skips RAS when applyRas=false', async () => {
    const { service, prisma, expertise, ras } = build();
    await service.create(companyId, {
      apBillId: billId,
      amount: 1000,
      method: 'BANK_TRANSFER' as never,
      paymentDate: '2026-09-15',
      applyRas: false,
    });
    expect(expertise.previewRas).not.toHaveBeenCalled();
    expect(ras.createFromApPayment).not.toHaveBeenCalled();
    expect(prisma.finApPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 1000,
          amountRas: 0,
          rasApplied: false,
        }),
      }),
    );
  });

  it('does not invent RAS when Prefs PENDING', async () => {
    const { service, prisma, expertise, ras } = build({
      ras: { applied: false, amount: 0, rateBps: null },
    });
    await service.create(companyId, {
      apBillId: billId,
      amount: 1000,
      method: 'BANK_TRANSFER' as never,
      paymentDate: '2026-09-15',
    });
    expect(expertise.previewRas).toHaveBeenCalled();
    expect(ras.createFromApPayment).not.toHaveBeenCalled();
    expect(prisma.finApPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 1000,
          amountRas: 0,
          rasApplied: false,
        }),
      }),
    );
  });
});
