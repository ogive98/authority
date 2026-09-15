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
        findFirst: jest.fn().mockResolvedValue({
          id: customerId,
          fulfillmentDoc: 'DELIVERY_NOTE',
        }),
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
      finInvoiceLine: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      prdProduct: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const tax = {
      resolveRateBps: jest.fn().mockResolvedValue({ rateBps: 1900 }),
      findCodeByCode: jest.fn(),
      resolveStubVat19: jest.fn().mockResolvedValue(taxCodeId),
      calculate: jest.fn().mockResolvedValue({
        decisions: [
          {
            applicable: true,
            kind: 'VAT',
            calculatedAmount: 19,
            rateBps: 1900,
            taxCode: 'TVA19',
            ruleId: taxCodeId,
            source: 'SYSTEM_RULE',
          },
        ],
      }),
      freezeDocumentLines: jest.fn().mockResolvedValue(0),
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
      fulfillmentDoc: 'DELIVERY_NOTE',
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
          fulfillmentDoc: data.fulfillmentDoc ?? created.fulfillmentDoc,
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

    return { service, prisma, expertise, created, tax };
  }

  it('does not invent FODEC/timbre when expertise is PENDING', async () => {
    const { service, expertise, created, tax } = build({
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
    expect(tax.calculate).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({ customerId }),
    );
  });

  it('resolves VAT from product when taxCodeId omitted (D271)', async () => {
    const productId = '44444444-4444-4444-4444-444444444444';
    const { service, prisma, tax } = build({
      fodec: null,
      timbre: null,
    });
    (prisma.prdProduct as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
      id: productId,
    });

    await service.create(companyId, {
      customerId,
      lines: [
        {
          description: 'Fromage',
          qty: 1,
          unitPriceHt: 100,
          productId,
        },
      ],
    });

    expect(tax.calculate).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        lines: [
          expect.objectContaining({
            productId,
            taxCodeId: undefined,
          }),
        ],
      }),
    );
  });

  it('passes productId to tax.calculate when provided', async () => {
    const productId = '44444444-4444-4444-4444-444444444444';
    const { service, prisma, tax } = build({
      fodec: null,
      timbre: null,
    });
    (prisma.prdProduct as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
      id: productId,
    });

    await service.create(companyId, {
      customerId,
      lines: [
        {
          description: 'Fromage',
          qty: 1,
          unitPriceHt: 100,
          taxCodeId,
          productId,
        },
      ],
    });

    expect(tax.calculate).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        customerId,
        lines: [expect.objectContaining({ productId, taxCodeId })],
      }),
    );
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

  it('inherits customer fulfillmentDoc and allows override (title only)', async () => {
    const { service, prisma, created } = build({ fodec: null, timbre: null });
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
    expect(created.fulfillmentDoc).toBe('DELIVERY_NOTE');

    await service.create(companyId, {
      customerId,
      fulfillmentDoc: 'INVOICE',
      lines: [
        {
          description: 'Fromage',
          qty: 1,
          unitPriceHt: 100,
          taxCodeId,
        },
      ],
    });
    expect(created.fulfillmentDoc).toBe('INVOICE');
    expect(prisma.finInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fulfillmentDoc: 'INVOICE' }),
      }),
    );
  });
});

describe('InvoiceService.cancel (D183)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const invoiceId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const openItemId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  it('cancels ISSUED invoice, closes open AR, emits cancelled', async () => {
    const invoice = {
      id: invoiceId,
      companyId,
      number: 'INV-1',
      customerId: '22222222-2222-2222-2222-222222222222',
      status: 'ISSUED',
      amountHt: { toString: () => '100' },
      amountTax: { toString: () => '19' },
      amountTotal: { toString: () => '119' },
      amountFodec: 0,
      amountTimbre: 0,
      salesOrderId: null,
      shipmentId: null,
      fulfillmentDoc: 'DELIVERY_NOTE',
      currency: 'TND',
      dueDate: null,
      issuedAt: new Date(),
      label: null,
      notes: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      openItems: [{ id: openItemId }],
      lines: [],
    };
    const prisma: Record<string, unknown> = {
      finInvoice: {
        findFirst: jest.fn().mockResolvedValue({ ...invoice, status: 'ISSUED' }),
        update: jest.fn().mockResolvedValue(null),
        findFirstOrThrow: jest
          .fn()
          .mockResolvedValue({ ...invoice, status: 'CANCELLED', openItems: [] }),
      },
      finOpenItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: openItemId,
          status: 'OPEN',
          amountOpen: 119,
          amountTotal: 119,
        }),
        update: jest.fn().mockResolvedValue(null),
      },
      finPromiseToPay: {
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
    const service = new InvoiceService(
      prisma as never,
      outbox as never,
      {} as never,
      {} as never,
    );

    const dto = await service.cancel(companyId, invoiceId);
    expect(dto.status).toBe('CANCELLED');
    expect(prisma.finOpenItem.update).toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventType: 'finance.invoice.cancelled.v1',
        payloadJson: expect.objectContaining({ invoiceId }),
      }),
    );
  });

  it('rejects cancel when AR is partially allocated', async () => {
    const prisma: Record<string, unknown> = {
      finInvoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: invoiceId,
          companyId,
          status: 'ISSUED',
          number: 'INV-1',
          customerId: 'c1',
          amountHt: 100,
          amountTax: 19,
          amountTotal: 119,
        }),
      },
      finOpenItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: openItemId,
          status: 'PARTIAL',
          amountOpen: 50,
          amountTotal: 119,
        }),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    const service = new InvoiceService(
      prisma as never,
      { enqueue: jest.fn() } as never,
      {} as never,
      {} as never,
    );
    await expect(service.cancel(companyId, invoiceId)).rejects.toMatchObject({
      code: 'FIN.INVALID_STATUS',
    });
  });
});
