import { HttpStatus } from '@nestjs/common';
import { HrTransferOrderStatus, Prisma } from '@prisma/client';
import { HR_ERROR_CODES, HR_EVENT_TYPES } from './hr.constants';
import { TransferOrderService } from './transfer-order.service';

describe('TransferOrderService (D222)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const bulletinId = '22222222-2222-2222-2222-222222222222';
  const employeeId = '33333333-3333-3333-3333-333333333333';
  const bankAccountId = '44444444-4444-4444-4444-444444444444';
  const userId = '55555555-5555-5555-5555-555555555555';
  const transferId = '66666666-6666-6666-6666-666666666666';

  function build() {
    const bulletin = {
      id: bulletinId,
      companyId,
      employeeId,
      number: 'BUL-2026-09-0001',
      periodYm: '2026-09',
      netPay: new Prisma.Decimal('1040.000'),
      currency: 'TND',
      deletedAt: null,
      employee: {
        id: employeeId,
        displayName: 'Amine Ben Ali',
        matricule: 'E-001',
        bankName: 'BIAT',
        bankAgency: 'Tunis',
        bankAccount: '20 006 0001234567890 12',
      },
    };

    const companyBank = {
      id: bankAccountId,
      companyId,
      code: 'BIAT-MAIN',
      label: 'Compte paie',
      bankName: 'BIAT',
      rib: '08 000 0000000000000 00',
      active: true,
      isDefault: true,
      deletedAt: null,
    };

    const draft = {
      id: transferId,
      companyId,
      number: 'TO-2026-0001',
      bulletinId,
      employeeId,
      bankAccountId,
      amount: new Prisma.Decimal('1040.000'),
      currency: 'TND',
      status: HrTransferOrderStatus.DRAFT,
      beneficiaryName: 'Amine Ben Ali',
      beneficiaryBankName: 'BIAT',
      beneficiaryBankAgency: 'Tunis',
      beneficiaryBankAccount: '20 006 0001234567890 12',
      companyBankCode: 'BIAT-MAIN',
      companyBankLabel: 'Compte paie',
      companyBankRib: '08 000 0000000000000 00',
      apPaymentId: null as string | null,
      pdfDocumentId: null,
      createdByUserId: userId,
      confirmedByUserId: null as string | null,
      confirmedAt: null as Date | null,
      version: 0,
      createdAt: new Date('2026-09-12T12:00:00.000Z'),
      updatedAt: new Date('2026-09-12T12:00:00.000Z'),
      deletedAt: null,
      bulletin: { number: bulletin.number, periodYm: bulletin.periodYm },
      employee: {
        displayName: bulletin.employee.displayName,
        matricule: bulletin.employee.matricule,
      },
      apPayment: null as { number: string } | null,
    };

    const prisma = {
      hrBulletin: {
        findFirst: jest.fn().mockResolvedValue(bulletin),
      },
      hrTransferOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(draft),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      finBankAccount: {
        findFirst: jest.fn().mockResolvedValue(companyBank),
        findMany: jest.fn().mockResolvedValue([companyBank]),
      },
      finApPayment: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          hrTransferOrder: prisma.hrTransferOrder,
          finApPayment: prisma.finApPayment,
        }),
      ),
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const service = new TransferOrderService(prisma as never, outbox as never);
    return { service, prisma, outbox, draft, bulletin };
  }

  it('creates DRAFT from bulletin netPay and snapshots banks', async () => {
    const { service, outbox } = build();
    const dto = await service.create(
      companyId,
      { bulletinId, bankAccountId },
      userId,
    );

    expect(dto.status).toBe(HrTransferOrderStatus.DRAFT);
    expect(dto.amount).toBe('1040.000');
    expect(dto.beneficiaryBankAccount).toContain('20 006');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: HR_EVENT_TYPES.TRANSFER_CREATED,
      }),
    );
  });

  it('rejects when employee RIB missing', async () => {
    const { service, prisma, bulletin } = build();
    prisma.hrBulletin.findFirst.mockResolvedValue({
      ...bulletin,
      employee: { ...bulletin.employee, bankAccount: null },
    });

    await expect(
      service.create(companyId, { bulletinId, bankAccountId }, userId),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { code: HR_ERROR_CODES.TRANSFER_BANK_REQUIRED },
    });
  });

  it('confirms DRAFT and posts FinApPayment BANK_TRANSFER', async () => {
    const { service, prisma, outbox, draft } = build();
    prisma.hrTransferOrder.findFirst.mockResolvedValue(draft);
    prisma.hrTransferOrder.update.mockResolvedValue({
      ...draft,
      status: HrTransferOrderStatus.CONFIRMED,
      confirmedByUserId: userId,
      confirmedAt: new Date(),
      apPaymentId: '77777777-7777-7777-7777-777777777777',
      apPayment: { number: 'AP-2026-0001' },
      version: 1,
    });
    prisma.finApPayment.create.mockResolvedValue({
      id: '77777777-7777-7777-7777-777777777777',
      number: 'AP-2026-0001',
    });

    const dto = await service.confirm(companyId, transferId, userId);

    expect(dto.status).toBe(HrTransferOrderStatus.CONFIRMED);
    expect(prisma.finApPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          method: 'BANK_TRANSFER',
          vendorName: 'Amine Ben Ali',
        }),
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: HR_EVENT_TYPES.TRANSFER_CONFIRMED,
      }),
    );
  });
});
