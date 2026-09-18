import { HttpStatus } from '@nestjs/common';
import { Prisma, SalQuoteStatus } from '@prisma/client';
import { SALES_ERROR_CODES } from './sales.constants';
import { SalesException } from './sales.exception';
import { SalesQuotesService } from './sales-quotes.service';

describe('SalesQuotesService (D316)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const quoteId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const orderId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const customerId = '22222222-2222-2222-2222-222222222222';
  const warehouseId = '33333333-3333-3333-3333-333333333333';
  const productId = '44444444-4444-4444-4444-444444444444';

  function draftQuote(overrides?: Partial<{ status: SalQuoteStatus; version: number }>) {
    return {
      id: quoteId,
      companyId,
      number: 'DEV-2026-0001',
      customerId,
      warehouseId,
      status: overrides?.status ?? SalQuoteStatus.DRAFT,
      validUntil: null,
      currency: 'TND',
      notes: null,
      amountTotal: new Prisma.Decimal(90),
      version: overrides?.version ?? 0,
      convertedOrderId: null as string | null,
      pdfDocumentId: null as string | null,
      acceptedAt: null,
      cancelledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      lines: [
        {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          companyId,
          quoteId,
          lineNo: 1,
          productId,
          qty: new Prisma.Decimal(10),
          unitPrice: new Prisma.Decimal(10),
          discountPct: new Prisma.Decimal(10),
          lineTotal: new Prisma.Decimal(90),
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
  }

  it('update refuses non-DRAFT quotes', async () => {
    const quote = draftQuote({ status: SalQuoteStatus.SENT });
    const prisma = {
      salQuote: {
        findFirst: jest.fn().mockResolvedValue(quote),
      },
    };
    const service = new SalesQuotesService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.update(companyId, quoteId, { version: 0, notes: 'x' }),
    ).rejects.toMatchObject({
      code: SALES_ERROR_CODES.INVALID_STATUS,
      status: HttpStatus.CONFLICT,
    });
  });

  it('convert is idempotent when already ACCEPTED', async () => {
    const quote = draftQuote({ status: SalQuoteStatus.ACCEPTED });
    quote.convertedOrderId = orderId;

    const orderDto = {
      id: orderId,
      number: 'SO-2026-0009',
      status: 'DRAFT',
      lines: [
        {
          discountPct: '10',
          lineTotal: '90',
        },
      ],
    };

    const prisma = {
      salQuote: {
        findFirst: jest.fn().mockResolvedValue(quote),
      },
      cusCustomer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: customerId,
            code: 'C1',
            party: { legalName: 'Atlas' },
          },
        ]),
      },
      invWarehouse: {
        findMany: jest.fn().mockResolvedValue([{ id: warehouseId, code: 'MAIN' }]),
      },
      prdProduct: {
        findMany: jest.fn().mockResolvedValue([
          { id: productId, sku: 'BRIE', name: 'Brie' },
        ]),
      },
    };

    const sales = {
      get: jest.fn().mockResolvedValue(orderDto),
      create: jest.fn(),
    };

    const service = new SalesQuotesService(
      prisma as never,
      {} as never,
      sales as never,
    );

    const result = await service.convert(companyId, quoteId);
    expect(sales.create).not.toHaveBeenCalled();
    expect(sales.get).toHaveBeenCalledWith(companyId, orderId);
    expect(result.order.id).toBe(orderId);
    expect(result.quote.status).toBe(SalQuoteStatus.ACCEPTED);
  });

  it('convert copies discountPct onto order create payload', async () => {
    const quote = draftQuote({ status: SalQuoteStatus.SENT });
    const createdOrder = {
      id: orderId,
      number: 'SO-2026-0010',
      status: 'DRAFT',
      lines: [{ discountPct: '10', lineTotal: '90' }],
    };

    let updatedStatus: SalQuoteStatus | null = null;

    const prisma = {
      salQuote: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(quote)
          .mockResolvedValue({
            ...quote,
            status: SalQuoteStatus.ACCEPTED,
            convertedOrderId: orderId,
          }),
        findFirstOrThrow: jest.fn().mockResolvedValue({
          ...quote,
          status: SalQuoteStatus.ACCEPTED,
          convertedOrderId: orderId,
        }),
        updateMany: jest.fn().mockImplementation(async ({ data }) => {
          updatedStatus = data.status;
          return { count: 1 };
        }),
      },
      cusCustomer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: customerId,
            code: 'C1',
            party: { legalName: 'Atlas' },
          },
        ]),
      },
      invWarehouse: {
        findMany: jest.fn().mockResolvedValue([{ id: warehouseId, code: 'MAIN' }]),
      },
      prdProduct: {
        findMany: jest.fn().mockResolvedValue([
          { id: productId, sku: 'BRIE', name: 'Brie' },
        ]),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          salQuote: prisma.salQuote,
        };
        return fn(tx);
      }),
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const sales = {
      create: jest.fn().mockResolvedValue(createdOrder),
      get: jest.fn(),
    };

    const service = new SalesQuotesService(
      prisma as never,
      outbox as never,
      sales as never,
    );

    const result = await service.convert(companyId, quoteId);
    expect(sales.create).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        confirmAfter: false,
        lines: [
          expect.objectContaining({
            productId,
            qty: 10,
            unitPrice: 10,
            discountPct: 10,
          }),
        ],
      }),
    );
    expect(updatedStatus).toBe(SalQuoteStatus.ACCEPTED);
    expect(result.order.id).toBe(orderId);
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('convert refuses DRAFT (must send first)', async () => {
    const quote = draftQuote({ status: SalQuoteStatus.DRAFT });
    const prisma = {
      salQuote: {
        findFirst: jest.fn().mockResolvedValue(quote),
      },
    };
    const service = new SalesQuotesService(
      prisma as never,
      {} as never,
      { create: jest.fn() } as never,
    );

    await expect(service.convert(companyId, quoteId)).rejects.toBeInstanceOf(
      SalesException,
    );
  });
});
