import { TaxDecisionSource, TaxKind } from '@prisma/client';
import { ApBillService } from './ap-bill.service';
import { FINANCE_ERROR_CODES } from './finance.constants';

describe('ApBillService tax lines (D276)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const taxCodeId = '33333333-3333-3333-3333-333333333333';

  it('creates a header-only bill without tax lines', async () => {
    const prisma = {
      supSupplier: { findFirst: jest.fn() },
      finApBill: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          finApBill: {
            create: jest.fn().mockResolvedValue({
              id: 'bill-1',
              companyId,
              number: 'APB-2026-0001',
              vendorName: 'Laiterie',
              supplierId: null,
              status: 'DRAFT',
              billDate: new Date('2026-09-16'),
              dueDate: null,
              amountTotal: 100,
              amountHt: 0,
              amountTax: 0,
              currency: 'TND',
              label: null,
              reference: null,
              notes: null,
              version: 0,
              postedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
        };
        return fn(tx);
      }),
    };
    const outbox = { enqueue: jest.fn() };
    const tax = {
      calculate: jest.fn(),
      resolveStubVat19: jest.fn(),
      freezeDocumentLines: jest.fn(),
    };
    const svc = new ApBillService(prisma as never, outbox as never, tax as never);
    const dto = await svc.create(companyId, {
      vendorName: 'Laiterie',
      amountTotal: 100,
      billDate: '2026-09-16',
    });
    expect(dto.amountTotal).toBe('100.000');
    expect(dto.amountTax).toBe('0.000');
    expect(tax.calculate).not.toHaveBeenCalled();
  });

  it('computes TTC from HT + engine VAT when lines provided', async () => {
    const prisma = {
      supSupplier: { findFirst: jest.fn() },
      finApBill: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          finApBill: {
            create: jest.fn().mockImplementation(({ data }) => ({
              id: 'bill-2',
              companyId,
              number: 'APB-2026-0002',
              vendorName: data.vendorName,
              supplierId: null,
              status: 'DRAFT',
              billDate: data.billDate,
              dueDate: null,
              amountTotal: data.amountTotal,
              amountHt: data.amountHt,
              amountTax: data.amountTax,
              currency: 'TND',
              label: null,
              reference: null,
              notes: null,
              version: 0,
              postedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              lines: [
                {
                  id: 'ln-1',
                  lineNo: 1,
                  description: 'Lait',
                  amountHt: 100,
                  amountTax: 19,
                  amountTtc: 119,
                  taxCodeId,
                  taxLineId: null,
                  taxCode: { code: 'TVA19' },
                },
              ],
            })),
          },
        };
        return fn(tx);
      }),
    };
    const outbox = { enqueue: jest.fn() };
    const tax = {
      resolveStubVat19: jest.fn().mockResolvedValue(taxCodeId),
      freezeDocumentLines: jest.fn(),
      calculate: jest.fn().mockResolvedValue({
        decisions: [
          {
            kind: TaxKind.VAT,
            applicable: true,
            calculatedAmount: 19,
            ruleId: taxCodeId,
            source: TaxDecisionSource.SYSTEM_RULE,
          },
        ],
      }),
    };
    const svc = new ApBillService(prisma as never, outbox as never, tax as never);
    const dto = await svc.create(companyId, {
      vendorName: 'Laiterie',
      billDate: '2026-09-16',
      lines: [{ amountHt: 100, description: 'Lait' }],
    });
    expect(dto.amountTotal).toBe('119.000');
    expect(dto.amountHt).toBe('100.000');
    expect(dto.amountTax).toBe('19.000');
    expect(tax.calculate).toHaveBeenCalled();
  });

  it('rejects a tax line without VAT code and without stub', async () => {
    const prisma = {
      supSupplier: { findFirst: jest.fn() },
      finApBill: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    const tax = {
      resolveStubVat19: jest.fn().mockResolvedValue(null),
      calculate: jest.fn(),
      freezeDocumentLines: jest.fn(),
    };
    const svc = new ApBillService(
      prisma as never,
      { enqueue: jest.fn() } as never,
      tax as never,
    );
    await expect(
      svc.create(companyId, {
        vendorName: 'X',
        billDate: '2026-09-16',
        lines: [{ amountHt: 10 }],
      }),
    ).rejects.toMatchObject({ code: FINANCE_ERROR_CODES.INVALID_AMOUNT });
  });
});
