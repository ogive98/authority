import { InvMovementType, SalOrderStatus } from '@prisma/client';
import { ThunderDomainRegistrar } from './thunder-domain.registrar';

describe('ThunderDomainRegistrar', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const orderId = '55555555-5555-5555-5555-555555555555';
  const customerId = '22222222-2222-2222-2222-222222222222';
  const warehouseId = '33333333-3333-3333-3333-333333333333';
  const productId = '44444444-4444-4444-4444-444444444444';
  const gl = {
    postInvoiceIssued: jest.fn(),
    postCreditNoteIssued: jest.fn(),
    postPaymentAllocated: jest.fn(),
    reversePaymentOnInstrumentReject: jest.fn(),
    reverseInvoiceIssued: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers named domain consumers', () => {
    const registry = { register: jest.fn() };
    new ThunderDomainRegistrar(
      registry as never,
      { isEnabled: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      gl as never,
    ).onModuleInit();

    expect(registry.register).toHaveBeenCalledWith(
      'inventory.reserveFromOrder',
      expect.any(Function),
      { consumes: ['sales.order.confirmed.v1'] },
    );
    expect(registry.register).toHaveBeenCalledWith(
      'finance.openItemFromDelivery',
      expect.any(Function),
      { consumes: ['delivery.shipment.delivered.v1'] },
    );
    expect(registry.register).toHaveBeenCalledWith(
      'accounting.postFromFinance',
      expect.any(Function),
      {
        consumes: [
          'finance.invoice.issued.v1',
          'finance.invoice.cancelled.v1',
          'finance.credit_note.issued.v1',
          'finance.payment.allocated.v1',
          'finance.payment.reversed.v1',
          'finance.instrument.rejected.v1',
        ],
      },
    );
  });

  it('skips reserve when movement already exists (idempotent)', async () => {
    const inventory = { reserve: jest.fn() };
    const modules = { isEnabled: jest.fn().mockResolvedValue(true) };
    const prisma = {
      setValue: { findFirst: jest.fn().mockResolvedValue(null) },
      salOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          number: 'SO-1',
          companyId,
          customerId,
          warehouseId,
          status: SalOrderStatus.CONFIRMED,
          lines: [{ productId, qty: { toString: () => '10' }, lineNo: 1 }],
        }),
      },
      invMovement: {
        findFirst: jest.fn().mockResolvedValue({ id: 'mov-1' }),
      },
    };
    const registrar = new ThunderDomainRegistrar(
      { register: jest.fn() } as never,
      modules as never,
      prisma as never,
      inventory as never,
      { ensureArForSalesOrder: jest.fn() } as never,
      gl as never,
    );

    await registrar.onSalesConfirmedReserve({
      eventId: 'e1',
      eventType: 'sales.order.confirmed.v1',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'sales',
      companyId,
      correlationId: 'c1',
      aggregateType: 'sal_order',
      aggregateId: orderId,
      payload: { orderId, customerId, warehouseId },
    });

    expect(inventory.reserve).not.toHaveBeenCalled();
    expect(prisma.invMovement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: InvMovementType.RESERVE,
          refId: orderId,
        }),
      }),
    );
  });

  it('creates AR on delivered via finance service', async () => {
    const finance = {
      ensureArForSalesOrder: jest.fn().mockResolvedValue({
        outcome: 'created',
        item: { number: 'FIN-1' },
      }),
    };
    const modules = { isEnabled: jest.fn().mockResolvedValue(true) };
    const prisma = {
      salOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          number: 'SO-1',
          customerId,
          amountTotal: { toString: () => '50' },
          currency: 'TND',
        }),
      },
    };
    const registrar = new ThunderDomainRegistrar(
      { register: jest.fn() } as never,
      modules as never,
      prisma as never,
      { reserve: jest.fn() } as never,
      finance as never,
      gl as never,
    );

    await registrar.onShipmentDeliveredAr({
      eventId: 'e2',
      eventType: 'delivery.shipment.delivered.v1',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'delivery',
      companyId,
      correlationId: 'c2',
      aggregateType: 'dlv_shipment',
      aggregateId: 'ship-1',
      payload: { orderId, customerId },
    });

    expect(finance.ensureArForSalesOrder).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        salesOrderId: orderId,
        customerId,
        amountTotal: 50,
      }),
    );
  });

  it('skips finance consumer when module disabled', async () => {
    const finance = { ensureArForSalesOrder: jest.fn() };
    const registrar = new ThunderDomainRegistrar(
      { register: jest.fn() } as never,
      { isEnabled: jest.fn().mockResolvedValue(false) } as never,
      {} as never,
      {} as never,
      finance as never,
      gl as never,
    );
    await registrar.onShipmentDeliveredAr({
      eventId: 'e3',
      eventType: 'delivery.shipment.delivered.v1',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'delivery',
      companyId,
      correlationId: 'c3',
      aggregateType: 'dlv_shipment',
      aggregateId: 'ship-1',
      payload: { orderId, customerId },
    });
    expect(finance.ensureArForSalesOrder).not.toHaveBeenCalled();
  });

  it('posts GL from finance.invoice.issued when accounting enabled', async () => {
    gl.postInvoiceIssued.mockResolvedValue({
      outcome: 'posted',
      entryId: 'je-1',
      number: 'JE-1',
    });
    const registrar = new ThunderDomainRegistrar(
      { register: jest.fn() } as never,
      { isEnabled: jest.fn().mockResolvedValue(true) } as never,
      {} as never,
      {} as never,
      {} as never,
      gl as never,
    );
    const invoiceId = '66666666-6666-6666-6666-666666666666';
    await registrar.onFinanceToGl({
      eventId: '77777777-7777-7777-7777-777777777777',
      eventType: 'finance.invoice.issued.v1',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'finance',
      companyId,
      correlationId: 'c4',
      aggregateType: 'fin_invoice',
      aggregateId: invoiceId,
      payload: { invoiceId, amountTotal: '120.500' },
    });
    expect(gl.postInvoiceIssued).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        invoiceId,
        amount: 120.5,
        sourceId: '77777777-7777-7777-7777-777777777777',
      }),
    );
  });

  it('posts GL from finance.credit_note.issued when accounting enabled', async () => {
    gl.postCreditNoteIssued.mockResolvedValue({
      outcome: 'posted',
      entryId: 'je-cn',
      number: 'JE-CN',
    });
    const registrar = new ThunderDomainRegistrar(
      { register: jest.fn() } as never,
      { isEnabled: jest.fn().mockResolvedValue(true) } as never,
      {} as never,
      {} as never,
      {} as never,
      gl as never,
    );
    const creditNoteId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    await registrar.onFinanceToGl({
      eventId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      eventType: 'finance.credit_note.issued.v1',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'finance',
      companyId,
      correlationId: 'c4b',
      aggregateType: 'fin_credit_note',
      aggregateId: creditNoteId,
      payload: {
        creditNoteId,
        amountTotal: '50.000',
        amountHt: '42.017',
        amountTax: '7.983',
      },
    });
    expect(gl.postCreditNoteIssued).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        creditNoteId,
        amount: 50,
        sourceId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      }),
    );
  });

  it('deaccounts GL from finance.invoice.cancelled when accounting enabled', async () => {
    gl.reverseInvoiceIssued.mockResolvedValue({
      outcome: 'posted',
      entryId: 'je-rev',
      number: 'JE-REV',
    });
    const registrar = new ThunderDomainRegistrar(
      { register: jest.fn() } as never,
      { isEnabled: jest.fn().mockResolvedValue(true) } as never,
      {} as never,
      {} as never,
      {} as never,
      gl as never,
    );
    const invoiceId = '66666666-6666-6666-6666-666666666666';
    await registrar.onFinanceToGl({
      eventId: '88888888-8888-8888-8888-888888888888',
      eventType: 'finance.invoice.cancelled.v1',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'finance',
      companyId,
      correlationId: 'c5',
      aggregateType: 'fin_invoice',
      aggregateId: invoiceId,
      payload: { invoiceId },
    });
    expect(gl.reverseInvoiceIssued).toHaveBeenCalledWith(companyId, {
      invoiceId,
      reverseSourceId: '88888888-8888-8888-8888-888888888888',
    });
  });

  it('reverses payment GL from finance.payment.reversed', async () => {
    gl.reversePaymentOnInstrumentReject.mockResolvedValue({
      outcome: 'posted',
      entryId: 'je-pay',
      number: 'JE-PAY',
    });
    const registrar = new ThunderDomainRegistrar(
      { register: jest.fn() } as never,
      { isEnabled: jest.fn().mockResolvedValue(true) } as never,
      {} as never,
      {} as never,
      {} as never,
      gl as never,
    );
    const paymentId = '99999999-9999-9999-9999-999999999999';
    await registrar.onFinanceToGl({
      eventId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      eventType: 'finance.payment.reversed.v1',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'finance',
      companyId,
      correlationId: 'c6',
      aggregateType: 'fin_payment',
      aggregateId: paymentId,
      payload: { paymentId },
    });
    expect(gl.reversePaymentOnInstrumentReject).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        paymentId,
        rejectSourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        sourceType: 'fin_payment_reverse',
      }),
    );
  });
});
