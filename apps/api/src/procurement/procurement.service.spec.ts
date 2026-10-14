import { HttpStatus } from '@nestjs/common';
import {
  ProcPoStatus,
  ProcReceiptKind,
  ProcReceiptStatus,
  ProcSuggestionStatus,
} from '@prisma/client';
import { PROCUREMENT_ERROR_CODES } from './procurement.constants';
import { ProcurementService } from './procurement.service';

describe('ProcurementService (unit wiring)', () => {
  it('exposes error codes for AUTHORITY clients', () => {
    expect(PROCUREMENT_ERROR_CODES.NOT_FOUND).toBe('PROC.NOT_FOUND');
    expect(PROCUREMENT_ERROR_CODES.VERSION_CONFLICT).toBe('PROC.VERSION_CONFLICT');
    expect(PROCUREMENT_ERROR_CODES.SUPPLIER_BLOCKED).toBe('PROC.SUPPLIER_BLOCKED');
    expect(PROCUREMENT_ERROR_CODES.QTY_EXCEEDS_ORDERED).toBe(
      'PROC.QTY_EXCEEDS_ORDERED',
    );
  });

  it('rejects PO creation without lines', async () => {
    const prisma = {
      $transaction: jest.fn(),
      procPo: { count: jest.fn() },
      procSuggestion: { count: jest.fn() },
      procReceipt: { count: jest.fn() },
    };
    const svc = new ProcurementService(
      prisma as never,
      { enqueue: jest.fn() } as never,
      { adjust: jest.fn() } as never,
      { create: jest.fn(), post: jest.fn() } as never,
    );

    await expect(
      svc.createPo('company-1', {
        supplierId: 'sup-1',
        lines: [],
      } as never),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: expect.objectContaining({
        code: PROCUREMENT_ERROR_CODES.EMPTY_LINES,
      }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks PO creation for a non-ACTIVE supplier', async () => {
    const prisma = {
      $transaction: jest.fn(),
      supSupplier: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sup-1',
          status: 'ON_HOLD',
        }),
      },
      prdProduct: {
        findFirst: jest.fn().mockResolvedValue({ id: 'prod-1' }),
      },
      procPo: { count: jest.fn() },
      procSuggestion: { count: jest.fn() },
      procReceipt: { count: jest.fn() },
    };
    const svc = new ProcurementService(
      prisma as never,
      { enqueue: jest.fn() } as never,
      { adjust: jest.fn() } as never,
      { create: jest.fn(), post: jest.fn() } as never,
    );

    await expect(
      svc.createPo('company-1', {
        supplierId: 'sup-1',
        lines: [{ productId: 'prod-1', qtyOrdered: 5, unitPrice: 10 }],
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: expect.objectContaining({
        code: PROCUREMENT_ERROR_CODES.SUPPLIER_BLOCKED,
      }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects receipt creation when qty exceeds remaining ordered qty', async () => {
    const po = {
      id: 'po-1',
      companyId: 'company-1',
      status: ProcPoStatus.CONFIRMED,
      version: 3,
      supplierId: 'sup-1',
      number: 'PO-2026-0001',
      deletedAt: null,
    };
    const prisma = {
      $transaction: jest.fn(),
      procPo: {
        findFirst: jest.fn().mockResolvedValue(po),
        count: jest.fn(),
      },
      procPoLine: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              id: 'line-1',
              poId: 'po-1',
              lineNo: 1,
              productId: 'prod-1',
              qtyOrdered: { toString: () => '10' },
              qtyReceived: { toString: () => '8' },
              unitPrice: { toString: () => '5' },
            },
          ]),
      },
      procReceipt: { create: jest.fn(), count: jest.fn() },
      procSuggestion: { count: jest.fn() },
    };
    const svc = new ProcurementService(
      prisma as never,
      { enqueue: jest.fn() } as never,
      { adjust: jest.fn() } as never,
      { create: jest.fn(), post: jest.fn() } as never,
    );

    await expect(
      svc.createReceipt('company-1', 'po-1', {
        version: 3,
        warehouseId: 'wh-1',
        lines: [{ poLineId: 'line-1', qty: 3 }],
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: expect.objectContaining({
        code: PROCUREMENT_ERROR_CODES.QTY_EXCEEDS_ORDERED,
      }),
    });
    expect(prisma.procReceipt.create).not.toHaveBeenCalled();
  });

  it('documents status enums for V0', () => {
    expect(Object.values(ProcPoStatus)).toEqual(
      expect.arrayContaining([
        'DRAFT',
        'SUBMITTED',
        'APPROVED',
        'SENT',
        'CONFIRMED',
        'PARTIAL',
        'RECEIVED',
        'CANCELLED',
      ]),
    );
    expect(ProcSuggestionStatus.OPEN).toBe('OPEN');
    expect(ProcReceiptStatus.DRAFT).toBe('DRAFT');
    expect(ProcReceiptKind.RECEIPT).toBe('RECEIPT');
  });
});
