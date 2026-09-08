import { InvoiceService } from './invoice.service';

describe('InvoiceService expertise surcharges (D093)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const customerId = '22222222-2222-2222-2222-222222222222';
  const taxCodeId = '33333333-3333-3333-3333-333333333333';

  function build(opts: {
    fodec?: { rateBps: number } | null;
    timbre?: { amountMilli?: number; rateBps?: number } | null;
  }) {
    const prisma: Record<string, unknown> = {
      cusCustomer: {
        findFirst: jest.fn().mockResolvedValue({ id: customerId }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: customerId,
            code: 'C1',
            party: { legalName: 'Client Demo' },
          },
        ]),
      },
      finInvoice: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findFirstOrThrow: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const tax = {
      resolveRateBps: jest.fn().mockResolvedValue({ rateBps: 1900 }),
      findCodeByCode: jest.fn(),
    };
    const expertise = {
      getFodec: jest.fn().mockResolvedValue(
        opts.fodec
          ? {
              key: 'tax.fodec',
              valueLabel: 'x',
              rateBps: opts.fodec.rateBps,
              amountMilli: null,
              lawRef: 'expert',
              expertValidatedAt: '2026-09-08',
              domain: 'tax',
              label: 'FODEC',
            }
          : null,
      ),
      getTimbre: jest.fn().mockResolvedValue(
        opts.timbre
          ? {
              key: 'tax.timbre',
              valueLabel: 'x',
              rateBps: opts.timbre.rateBps ?? null,
              amountMilli: opts.timbre.amountMilli ?? null,
              lawRef: 'expert',
              expertValidatedAt: '2026-09-08',
              domain: 'tax',
              label: 'Timbre',
            }
          : null,
      ),
    };

    const created = {
      id: 'inv-1',
      companyId,
      number: 'INV-2026-0001',
      customerId,
      status: 'DRAFT',
      salesOrderId: null,
      shipmentId: null,
      currency: 'TND',
      amountHt: 100,
      amountTax: 19,
      amountFodec: 0,
      amountTimbre: 0,
      amountTotal: 119,
      dueDate: null,
      issuedAt: null,
      label: null,
      notes: null,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      openItems: [],
      lines: [],
    };

    (prisma.finInvoice as { create: jest.Mock }).create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(created, {
          amountHt: data.amountHt,
          amountTax: data.amountTax,
          amountFodec: data.amountFodec,
          amountTimbre: data.amountTimbre,
          amountTotal: data.amountTotal,
        });
        return Promise.resolve(created);
      },
    );
    (prisma.finInvoice as { findFirstOrThrow: jest.Mock }).findFirstOrThrow.mockResolvedValue(
      created,
    );

    const service = new InvoiceService(
      prisma as never,
      outbox as never,
      tax as never,
      expertise as never,
    );

    return { service, prisma, expertise, created };
  }

  it('does not invent FODEC/timbre when expertise is PENDING', async () => {
    const { service, expertise, created } = build({
      fodec: null,
      timbre: null,
    });

    await service.create(companyId, {
      customerId,
      lines: [
        {
          description: 'Fromage',
          qty: 1,
          unitPriceHt: 100,
          taxCodeId,
        },
      ],
    });

    expect(expertise.getFodec).toHaveBeenCalled();
    expect(Number(created.amountFodec)).toBe(0);
    expect(Number(created.amountTimbre)).toBe(0);
    expect(Number(created.amountTotal)).toBe(119);
  });

  it('applies FODEC rateBps on HT when VALIDATED', async () => {
    const { service, created } = build({ fodec: { rateBps: 100 } });

    await service.create(companyId, {
      customerId,
      lines: [
        {
          description: 'Fromage',
          qty: 1,
          unitPriceHt: 100,
          taxCodeId,
        },
      ],
    });

    expect(Number(created.amountFodec)).toBe(1);
    expect(Number(created.amountTotal)).toBe(120);
  });

  it('applies timbre millimes when VALIDATED', async () => {
    const { service, created } = build({
      timbre: { amountMilli: 1000 },
    });

    await service.create(companyId, {
      customerId,
      lines: [
        {
          description: 'Fromage',
          qty: 1,
          unitPriceHt: 100,
          taxCodeId,
        },
      ],
    });

    expect(Number(created.amountTimbre)).toBe(1);
    expect(Number(created.amountTotal)).toBe(120);
  });
});
