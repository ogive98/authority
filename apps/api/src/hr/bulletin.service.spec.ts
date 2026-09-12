import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HR_ERROR_CODES } from './hr.constants';
import { BulletinService } from './bulletin.service';

describe('BulletinService.getForEmployee (D221)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const employeeId = '22222222-2222-2222-2222-222222222222';
  const otherEmployeeId = '33333333-3333-3333-3333-333333333333';
  const bulletinId = '44444444-4444-4444-4444-444444444444';

  const row = {
    id: bulletinId,
    companyId,
    periodYm: '2026-09',
    employeeId,
    contractId: '55555555-5555-5555-5555-555555555555',
    number: 'BUL-2026-09-0001',
    wageBase: new Prisma.Decimal('1200'),
    cnssEmployeeAmount: new Prisma.Decimal('110'),
    cnssEmployerAmount: new Prisma.Decimal('200'),
    irppMonthly: new Prisma.Decimal('50'),
    netPay: new Prisma.Decimal('1040'),
    cnssSnapshotId: null,
    irppSnapshotId: null,
    pdfDocumentId: null,
    currency: 'TND',
    version: 0,
    createdAt: new Date('2026-09-12T10:00:00.000Z'),
    updatedAt: new Date('2026-09-12T10:00:00.000Z'),
    employee: { displayName: 'Amine Ben Ali', matricule: 'E-001' },
    contract: { number: 'CTR-001' },
  };

  function build() {
    const prisma = {
      hrBulletin: {
        findFirst: jest.fn(),
      },
      hrIrppSnapshot: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const outbox = { enqueue: jest.fn() };
    const service = new BulletinService(prisma as never, outbox as never);
    return { service, prisma };
  }

  it('returns bulletin when employee owns it', async () => {
    const { service, prisma } = build();
    prisma.hrBulletin.findFirst.mockResolvedValue(row);

    const dto = await service.getForEmployee(companyId, employeeId, bulletinId);

    expect(dto.id).toBe(bulletinId);
    expect(dto.netPay).toBe('1040.000');
    expect(prisma.hrBulletin.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: bulletinId,
          companyId,
          employeeId,
          deletedAt: null,
        }),
      }),
    );
  });

  it('returns NOT_FOUND for other employee (IDOR)', async () => {
    const { service, prisma } = build();
    prisma.hrBulletin.findFirst.mockResolvedValue(null);

    await expect(
      service.getForEmployee(companyId, otherEmployeeId, bulletinId),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: expect.objectContaining({
        code: HR_ERROR_CODES.BULLETIN_NOT_FOUND,
      }),
    });
  });
});
