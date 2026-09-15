import { HttpStatus } from '@nestjs/common';
import {
  TaxCalcMethod,
  TaxKind,
  TaxRuleStatus,
} from '@prisma/client';
import { TAX_DECISION_REASONS, TAX_ERROR_CODES } from './tax.constants';
import { TaxService, taxFromHt, taxFromQty } from './tax.service';

describe('TaxService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const codeId = '22222222-2222-2222-2222-222222222222';
  const rateId = '33333333-3333-3333-3333-333333333333';
  const specId = '44444444-4444-4444-4444-444444444444';
  const specRateId = '55555555-5555-5555-5555-555555555555';

  function vatCode(overrides: Record<string, unknown> = {}) {
    return {
      id: codeId,
      companyId,
      code: 'TVA19',
      label: 'TVA normale 19%',
      kind: TaxKind.VAT,
      calcMethod: TaxCalcMethod.RATE,
      status: TaxRuleStatus.ACTIVE,
      active: true,
      unit: null,
      currency: 'TND',
      description: null,
      priority: 0,
      lawRef: 'Code TVA art.7',
      validatedBy: null,
      validatedAt: new Date('2026-09-08T00:00:00.000Z'),
      validationComment: null,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    };
  }

  function vatRate(overrides: Record<string, unknown> = {}) {
    return {
      id: rateId,
      companyId,
      taxCodeId: codeId,
      calcMethod: TaxCalcMethod.RATE,
      rateBps: 1900,
      amountMilli: null,
      unit: null,
      currency: 'TND',
      status: TaxRuleStatus.VALIDATED,
      validFrom: new Date('2018-01-01T00:00:00.000Z'),
      validTo: null as Date | null,
      lawRef: 'Code TVA art.7',
      expertValidatedAt: new Date('2026-09-08T00:00:00.000Z'),
      validatedBy: null,
      validationComment: null,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    };
  }

  function build(opts?: {
    code?: Record<string, unknown>;
    rate?: Record<string, unknown> | null;
  }) {
    const code = vatCode(opts?.code);
    const rate = opts?.rate === null ? null : vatRate(opts?.rate);

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma: any = {
      taxCode: {
        findMany: jest.fn().mockResolvedValue([code]),
        findFirst: jest.fn().mockResolvedValue(code),
      },
      taxRate: {
        findMany: jest.fn().mockResolvedValue(rate ? [rate] : []),
        findFirst: jest.fn().mockResolvedValue(rate),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...vatRate(), ...data, id: rateId }),
        ),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...vatRate(), ...data }),
        ),
      },
      cusFiscalRuleOverride: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      prdFiscalRuleOverride: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      prdFiscalProfile: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const service = new TaxService(prisma as never, outbox as never);
    return { service, prisma, outbox, code, rate };
  }

  it('computes tax from HT with basis points', () => {
    expect(taxFromHt(100, 1900)).toBe(19);
    expect(taxFromHt(100, 700)).toBe(7);
    expect(taxFromHt(42.017, 1900)).toBe(7.983);
    expect(taxFromHt(100, 0)).toBe(0);
  });

  it('computes quantity tax from millimes without inventing a legal rate', () => {
    expect(taxFromQty(30, 3000)).toBe(90);
    expect(taxFromQty(59, 3000)).toBe(177);
  });

  it('lists codes with current rate', async () => {
    const { service } = build();
    const { items } = await service.listCodes(companyId);
    expect(items).toHaveLength(1);
    expect(items[0]!.code).toBe('TVA19');
    expect(items[0]!.currentRateBps).toBe(1900);
    expect(items[0]!.status).toBe(TaxRuleStatus.ACTIVE);
    expect(items[0]!.calcMethod).toBe(TaxCalcMethod.RATE);
  });

  it('resolves rate bps for invoice computation', async () => {
    const { service } = build();
    const resolved = await service.resolveRateBps(companyId, codeId);
    expect(resolved.rateBps).toBe(1900);
  });

  it('rejects missing tax code', async () => {
    const { service, prisma } = build();
    prisma.taxCode.findFirst = jest.fn().mockResolvedValue(null);
    await expect(service.resolveRateBps(companyId, codeId)).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: TAX_ERROR_CODES.CODE_NOT_FOUND },
    });
  });

  it('calculate applies ACTIVE VAT RATE and explains why', async () => {
    const { service } = build();
    const { decisions } = await service.calculate(companyId, {
      lines: [{ taxCodeId: codeId, qty: 1, unitPriceHt: 100, amountHt: 100 }],
    });
    expect(decisions).toHaveLength(1);
    const d = decisions[0]!;
    expect(d.applicable).toBe(true);
    expect(d.kind).toBe(TaxKind.VAT);
    expect(d.calcMethod).toBe(TaxCalcMethod.RATE);
    expect(d.taxCode).toBe('TVA19');
    expect(d.calculatedAmount).toBe(19);
    expect(d.rateBps).toBe(1900);
    expect(d.reason).toContain(TAX_DECISION_REASONS.APPLIED_RATE);
    expect(d.source).toBe('SYSTEM_RULE');
  });

  it('calculate does not apply PENDING_EXPERT specific tax even if amountMilli is set', async () => {
    const { service } = build({
      code: {
        id: specId,
        code: 'SPEC_QTY',
        label: 'Generic quantity tax',
        kind: TaxKind.SPECIFIC_TAX,
        calcMethod: TaxCalcMethod.QTY,
        status: TaxRuleStatus.PENDING_EXPERT,
        unit: 'KG',
      },
      rate: {
        id: specRateId,
        taxCodeId: specId,
        calcMethod: TaxCalcMethod.QTY,
        rateBps: 0,
        amountMilli: 3000,
        unit: 'KG',
        status: TaxRuleStatus.PENDING_EXPERT,
      },
    });
    const { decisions } = await service.calculate(companyId, {
      lines: [
        {
          taxCodeId: specId,
          qty: 30,
          unit: 'KG',
          unitPriceHt: 18,
          amountHt: 540,
        },
      ],
    });
    expect(decisions[0]!.applicable).toBe(false);
    expect(decisions[0]!.calculatedAmount).toBe(0);
    expect(decisions[0]!.reason).toContain(TAX_DECISION_REASONS.PENDING_EXPERT);
  });

  it('calculate applies ACTIVE QTY rule only when amountMilli is validated', async () => {
    const { service } = build({
      code: {
        id: specId,
        code: 'SPEC_QTY',
        label: 'Generic quantity tax',
        kind: TaxKind.SPECIFIC_TAX,
        calcMethod: TaxCalcMethod.QTY,
        status: TaxRuleStatus.ACTIVE,
        unit: 'KG',
      },
      rate: {
        id: specRateId,
        taxCodeId: specId,
        calcMethod: TaxCalcMethod.QTY,
        rateBps: 0,
        amountMilli: 3000,
        unit: 'KG',
        status: TaxRuleStatus.VALIDATED,
      },
    });
    const { decisions } = await service.calculate(companyId, {
      lines: [
        {
          taxCodeId: specId,
          qty: 30,
          unit: 'KG',
          unitPriceHt: 18,
        },
      ],
    });
    expect(decisions[0]!.applicable).toBe(true);
    expect(decisions[0]!.calculatedAmount).toBe(90);
    expect(decisions[0]!.reason).toContain(TAX_DECISION_REASONS.APPLIED_QTY);
  });

  it('calculate returns AMOUNT_NOT_VALIDATED for ACTIVE QTY without amountMilli', async () => {
    const { service } = build({
      code: {
        id: specId,
        code: 'SPEC_QTY',
        label: 'Generic quantity tax',
        kind: TaxKind.SPECIFIC_TAX,
        calcMethod: TaxCalcMethod.QTY,
        status: TaxRuleStatus.ACTIVE,
        unit: 'KG',
      },
      rate: {
        id: specRateId,
        taxCodeId: specId,
        calcMethod: TaxCalcMethod.QTY,
        rateBps: 0,
        amountMilli: null,
        unit: 'KG',
      },
    });
    const { decisions } = await service.calculate(companyId, {
      lines: [{ taxCodeId: specId, qty: 30, unit: 'KG', unitPriceHt: 18 }],
    });
    expect(decisions[0]!.applicable).toBe(false);
    expect(decisions[0]!.calculatedAmount).toBe(0);
    expect(decisions[0]!.reason).toContain(
      TAX_DECISION_REASONS.AMOUNT_NOT_VALIDATED,
    );
  });

  it('emits published + changed events when creating a VAT rate', async () => {
    const { service, outbox } = build();
    await service.createRate(companyId, {
      taxCodeId: codeId,
      rateBps: 1900,
      validFrom: '2018-01-01',
      lawRef: 'Code TVA art.7',
    });
    const types = outbox.enqueue.mock.calls.map(
      (c: unknown[]) => (c[1] as { eventType: string }).eventType,
    );
    expect(types).toContain('tax.rate.published.v1');
    expect(types).toContain('tax.rate.changed.v1');
  });

  it('calculate NEVER customer override skips ACTIVE VAT (exemption)', async () => {
    const { service, prisma } = build();
    prisma.cusFiscalRuleOverride.findFirst = jest.fn().mockResolvedValue({
      mode: 'NEVER',
      source: 'EXEMPTION',
      justification: 'client exonéré',
      validFrom: null,
      validTo: null,
      deletedAt: null,
    });
    const customerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const { decisions } = await service.calculate(companyId, {
      customerId,
      lines: [{ taxCodeId: codeId, qty: 1, unitPriceHt: 100, amountHt: 100 }],
    });
    expect(decisions[0]!.applicable).toBe(false);
    expect(decisions[0]!.calculatedAmount).toBe(0);
    expect(decisions[0]!.source).toBe('EXEMPTION');
    expect(decisions[0]!.reason).toContain(TAX_DECISION_REASONS.EXEMPTION);
  });

  it('calculate ALWAYS cannot force PENDING_EXPERT into a charge', async () => {
    const { service, prisma } = build({
      code: { status: TaxRuleStatus.PENDING_EXPERT },
    });
    prisma.cusFiscalRuleOverride.findFirst = jest.fn().mockResolvedValue({
      mode: 'ALWAYS',
      source: 'CLIENT_OVERRIDE',
      justification: 'forcer',
      validFrom: null,
      validTo: null,
      deletedAt: null,
    });
    const { decisions } = await service.calculate(companyId, {
      customerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      lines: [{ taxCodeId: codeId, qty: 1, unitPriceHt: 100, amountHt: 100 }],
    });
    expect(decisions[0]!.applicable).toBe(false);
    expect(decisions[0]!.calculatedAmount).toBe(0);
    expect(decisions[0]!.reason).toContain(TAX_DECISION_REASONS.PENDING_EXPERT);
  });

  it('calculate NEVER product override skips ACTIVE VAT (exemption)', async () => {
    const { service, prisma } = build();
    const productId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    prisma.prdFiscalRuleOverride.findFirst = jest.fn().mockResolvedValue({
      mode: 'NEVER',
      source: 'EXEMPTION',
      justification: 'produit exonéré',
      validFrom: null,
      validTo: null,
      deletedAt: null,
    });
    const { decisions } = await service.calculate(companyId, {
      lines: [
        {
          taxCodeId: codeId,
          productId,
          qty: 1,
          unitPriceHt: 100,
          amountHt: 100,
        },
      ],
    });
    expect(decisions[0]!.applicable).toBe(false);
    expect(decisions[0]!.calculatedAmount).toBe(0);
    expect(decisions[0]!.source).toBe('EXEMPTION');
    expect(decisions[0]!.reason).toContain(TAX_DECISION_REASONS.EXEMPTION);
    expect(decisions[0]!.productId).toBe(productId);
  });

  it('customer NEVER wins over product ALWAYS', async () => {
    const { service, prisma } = build();
    prisma.cusFiscalRuleOverride.findFirst = jest.fn().mockResolvedValue({
      mode: 'NEVER',
      source: 'EXEMPTION',
      justification: 'client exonéré',
      validFrom: null,
      validTo: null,
      deletedAt: null,
    });
    prisma.prdFiscalRuleOverride.findFirst = jest.fn().mockResolvedValue({
      mode: 'ALWAYS',
      source: 'CLIENT_OVERRIDE',
      justification: 'forcer produit',
      validFrom: null,
      validTo: null,
      deletedAt: null,
    });
    const { decisions } = await service.calculate(companyId, {
      customerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      lines: [
        {
          taxCodeId: codeId,
          productId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          qty: 1,
          unitPriceHt: 100,
          amountHt: 100,
        },
      ],
    });
    expect(decisions[0]!.applicable).toBe(false);
    expect(decisions[0]!.calculatedAmount).toBe(0);
    expect(decisions[0]!.source).toBe('EXEMPTION');
    expect(decisions[0]!.reason).toContain('NEVER for this customer');
  });

  it('uses product default VAT when taxCodeId is omitted', async () => {
    const { service, prisma } = build();
    const productId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    prisma.prdFiscalProfile.findFirst = jest.fn().mockResolvedValue({
      defaultVatTaxCodeId: codeId,
    });
    const { decisions } = await service.calculate(companyId, {
      lines: [{ productId, qty: 1, unitPriceHt: 100, amountHt: 100 }],
    });
    expect(decisions[0]!.applicable).toBe(true);
    expect(decisions[0]!.calculatedAmount).toBe(19);
    expect(decisions[0]!.productId).toBe(productId);
    expect(prisma.taxCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: codeId }) }),
    );
  });
});
