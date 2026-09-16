import { FinApBillStatus, FinPaymentStatus } from '@prisma/client';
import { Supplier360Service } from './supplier-360.service';

describe('Supplier360Service (D281)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const supplierId = '22222222-2222-2222-2222-222222222222';

  const supplierDto = {
    id: supplierId,
    companyId,
    partyId: '33333333-3333-3333-3333-333333333333',
    code: 'F-01',
    legalName: 'Laiterie Nord',
    taxId: null,
    category: 'LAIT' as const,
    leadTimeDays: 2,
    moqDefault: null,
    preferred: true,
    qualityHold: false,
    paymentTerms: null,
    notes: null,
    status: 'ACTIVE' as const,
    version: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contacts: [],
  };

  it('builds summary with AP totals and draft action', async () => {
    const prisma = {
      supContact: { count: jest.fn().mockResolvedValue(2) },
      finApBill: {
        count: jest
          .fn()
          .mockResolvedValueOnce(1) // draft
          .mockResolvedValueOnce(3), // posted
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amountTotal: { toString: () => '1500.000' } },
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'b1',
            number: 'APB-1',
            status: FinApBillStatus.POSTED,
            amountTotal: { toString: () => '500.000' },
            billDate: new Date('2026-09-01'),
            createdAt: new Date('2026-09-01'),
          },
        ]),
      },
      finApPayment: {
        count: jest.fn().mockResolvedValue(2),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: { toString: () => '200.000' } },
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            number: 'APP-1',
            status: FinPaymentStatus.POSTED,
            amount: { toString: () => '200.000' },
            paymentDate: new Date('2026-09-02'),
            createdAt: new Date('2026-09-02'),
            apBillId: 'b1',
          },
        ]),
      },
    };
    const suppliers = {
      get: jest.fn().mockResolvedValue(supplierDto),
    };
    const svc = new Supplier360Service(prisma as never, suppliers as never);
    const dto = await svc.summary(companyId, supplierId);
    expect(dto.counts.contacts).toBe(2);
    expect(dto.counts.draftBills).toBe(1);
    expect(dto.counts.postedBills).toBe(3);
    expect(dto.ap.openTotal).toBe('1500.000');
    expect(dto.ap.paidTotal).toBe('200.000');
    expect(dto.actionRequired.some((a) => a.code === 'DRAFT_BILLS')).toBe(
      true,
    );
    expect(dto.recent.bills[0]?.number).toBe('APB-1');
  });

  it('merges bill + payment timeline sorted desc', async () => {
    const prisma = {
      finApBill: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'b1',
            number: 'APB-1',
            status: FinApBillStatus.POSTED,
            amountTotal: { toString: () => '100' },
            vendorName: 'Nord',
            createdAt: new Date('2026-09-01T10:00:00Z'),
            postedAt: new Date('2026-09-01T12:00:00Z'),
          },
        ]),
      },
      finApPayment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            number: 'APP-1',
            status: FinPaymentStatus.POSTED,
            amount: { toString: () => '50' },
            vendorName: 'Nord',
            createdAt: new Date('2026-09-02T10:00:00Z'),
            paymentDate: new Date('2026-09-02'),
          },
        ]),
      },
    };
    const suppliers = {
      get: jest.fn().mockResolvedValue(supplierDto),
    };
    const svc = new Supplier360Service(prisma as never, suppliers as never);
    const tl = await svc.timeline(companyId, supplierId, { limit: 10 });
    expect(tl.items[0]?.kind).toBe('ap_payment');
    expect(tl.items[1]?.kind).toBe('ap_bill');
  });
});
