import { RAS_DECISION_CODES, RasEngineService } from './ras-engine.service';

describe('RasEngineService (D282)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';

  function build(expertise: unknown, prisma?: unknown, outbox?: unknown) {
    return new RasEngineService(
      (prisma ?? {
        taxWithholding: {
          create: jest.fn(),
          findMany: jest.fn(),
          findFirst: jest.fn(),
          update: jest.fn(),
        },
        $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
          fn({
            taxWithholding: {
              create: jest.fn().mockResolvedValue({
                id: 'wh-1',
                companyId,
                status: 'CALCULATED',
                applicable: true,
                decisionCode: RAS_DECISION_CODES.APPLICABLE,
                decisionReason: 'ok',
                supplierId: null,
                apBillId: null,
                apPaymentId: null,
                vendorName: 'Nord',
                baseAmount: { toString: () => '1000.000' },
                rateBps: 150,
                withholdingAmount: { toString: () => '15.000' },
                netPayable: { toString: () => '985.000' },
                currency: 'TND',
                lawRef: 'Expert',
                periodLabel: '2026-09',
                prefsSnapshotJson: {},
                isStubRate: false,
                version: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
              }),
            },
          }),
        ),
      }) as never,
      expertise as never,
      (outbox ?? { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) }) as never,
    );
  }

  it('returns PREFS_PENDING when tax.ras not VALIDATED', async () => {
    const expertise = {
      getSlot: jest.fn().mockResolvedValue({
        status: 'PENDING_EXPERT',
        lawRef: null,
        notes: null,
        rateBps: null,
        valueSummary: null,
      }),
      previewRas: jest.fn(),
    };
    const svc = build(expertise);
    const d = await svc.detect(companyId, {
      baseAmount: 1000,
      vendorName: 'Nord',
    });
    expect(d.applicable).toBeNull();
    expect(d.decisionCode).toBe(RAS_DECISION_CODES.PREFS_PENDING);
    expect(d.withholdingAmount).toBe('0.000');
    expect(expertise.previewRas).not.toHaveBeenCalled();
  });

  it('calculates when Prefs VALIDATED with rateBps', async () => {
    const expertise = {
      getSlot: jest.fn().mockResolvedValue({
        status: 'VALIDATED',
        lawRef: 'LF expert',
        notes: null,
        rateBps: 150,
        valueSummary: '1,5 %',
      }),
      previewRas: jest.fn().mockResolvedValue({
        applied: true,
        amount: 15,
        rateBps: 150,
        ras: { rateBps: 150 },
      }),
    };
    const svc = build(expertise);
    const d = await svc.detect(companyId, {
      baseAmount: 1000,
      vendorName: 'Nord',
    });
    expect(d.applicable).toBe(true);
    expect(d.decisionCode).toBe(RAS_DECISION_CODES.APPLICABLE);
    expect(d.withholdingAmount).toBe('15.000');
    expect(d.netPayable).toBe('985.000');
  });

  it('flags STUB_UNTIL_EXPERT and blocks validate', async () => {
    const expertise = {
      getSlot: jest.fn().mockResolvedValue({
        status: 'VALIDATED',
        lawRef: 'STUB_UNTIL_EXPERT — remplacer',
        notes: 'STUB_UNTIL_EXPERT',
        rateBps: 100,
        valueSummary: '1 %',
      }),
      previewRas: jest.fn().mockResolvedValue({
        applied: true,
        amount: 10,
        rateBps: 100,
        ras: {},
      }),
    };
    const row = {
      id: 'wh-1',
      companyId,
      status: 'CALCULATED',
      applicable: true,
      decisionCode: RAS_DECISION_CODES.PREFS_STUB,
      decisionReason: 'stub',
      supplierId: null,
      apBillId: null,
      apPaymentId: null,
      vendorName: 'Nord',
      baseAmount: { toString: () => '1000' },
      rateBps: 100,
      withholdingAmount: { toString: () => '10' },
      netPayable: { toString: () => '990' },
      currency: 'TND',
      lawRef: 'STUB',
      periodLabel: null,
      prefsSnapshotJson: {},
      isStubRate: true,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      taxWithholding: {
        findFirst: jest.fn().mockResolvedValue(row),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const svc = build(expertise, prisma);
    const d = await svc.detect(companyId, {
      baseAmount: 1000,
      vendorName: 'Nord',
    });
    expect(d.isStubRate).toBe(true);
    expect(d.decisionCode).toBe(RAS_DECISION_CODES.PREFS_STUB);
    await expect(svc.validate(companyId, 'wh-1')).rejects.toMatchObject({
      code: 'TAX.INVALID_STATUS',
    });
  });
});
