import { HttpStatus } from '@nestjs/common';
import {
  DlvShipmentStatus,
  Prisma,
  RetDisposition,
  RetRmaStatus,
} from '@prisma/client';
import { RETURNS_ERROR_CODES } from './returns.constants';
import { ReturnsService } from './returns.service';

describe('ReturnsService (D317)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const shipmentId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const orderId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const orderLineId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const productId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const warehouseId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const customerId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  const rmaId = '99999999-9999-9999-9999-999999999999';

  function draftRma(overrides?: { status?: RetRmaStatus; creditNoteId?: string | null }) {
    return {
      id: rmaId,
      companyId,
      number: 'RET-2026-0001',
      shipmentId,
      orderId,
      customerId,
      warehouseId,
      invoiceId: null as string | null,
      creditNoteId: overrides?.creditNoteId ?? null,
      status: overrides?.status ?? RetRmaStatus.DRAFT,
      notes: null,
      version: 0,
      postedAt: null,
      cancelledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      lines: [
        {
          id: '11111111-2222-3333-4444-555555555555',
          companyId,
          rmaId,
          lineNo: 1,
          orderLineId,
          productId,
          qty: new Prisma.Decimal(2),
          disposition: RetDisposition.RESTOCK,
          unitPrice: new Prisma.Decimal(5),
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
  }

  it('rejects create when shipment is not DELIVERED', async () => {
    const prisma = {
      dlvShipment: {
        findFirst: jest.fn().mockResolvedValue({
          id: shipmentId,
          companyId,
          orderId,
          customerId,
          warehouseId,
          status: DlvShipmentStatus.OUT,
          deletedAt: null,
        }),
      },
    };
    const service = new ReturnsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.create(companyId, {
        shipmentId,
        lines: [
          {
            orderLineId,
            qty: 1,
            disposition: RetDisposition.RESTOCK,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: RETURNS_ERROR_CODES.SHIPMENT_NOT_DELIVERED,
      status: HttpStatus.CONFLICT,
    });
  });

  it('createCreditNote is idempotent when already linked', async () => {
    const rma = draftRma({
      status: RetRmaStatus.POSTED,
      creditNoteId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });
    const prisma = {
      retRma: {
        findFirst: jest.fn().mockResolvedValue(rma),
      },
      dlvShipment: { findMany: jest.fn().mockResolvedValue([]) },
      salOrder: { findMany: jest.fn().mockResolvedValue([]) },
      cusCustomer: { findMany: jest.fn().mockResolvedValue([]) },
      invWarehouse: { findMany: jest.fn().mockResolvedValue([]) },
      finInvoice: { findMany: jest.fn().mockResolvedValue([]) },
      finCreditNote: {
        findMany: jest.fn().mockResolvedValue([
          { id: rma.creditNoteId, number: 'AV-2026-0001' },
        ]),
      },
      prdProduct: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const creditNotes = { create: jest.fn() };
    const service = new ReturnsService(
      prisma as never,
      {} as never,
      {} as never,
      creditNotes as never,
    );

    const result = await service.createCreditNote(companyId, rmaId);
    expect(creditNotes.create).not.toHaveBeenCalled();
    expect(result.creditNoteId).toBe(rma.creditNoteId);
  });

  it('update refuses non-DRAFT', async () => {
    const prisma = {
      retRma: {
        findFirst: jest
          .fn()
          .mockResolvedValue(draftRma({ status: RetRmaStatus.POSTED })),
      },
    };
    const service = new ReturnsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.update(companyId, rmaId, { version: 0, notes: 'x' }),
    ).rejects.toMatchObject({
      code: RETURNS_ERROR_CODES.INVALID_STATUS,
    });
  });
});
