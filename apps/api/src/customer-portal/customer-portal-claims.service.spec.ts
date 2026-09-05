import { HttpStatus } from '@nestjs/common';
import { PtlClaimStatus, PtlClaimType } from '@prisma/client';
import { CUSTOMER_PORTAL_ERROR_CODES } from './customer-portal.constants';
import { CustomerPortalClaimsService } from './customer-portal-claims.service';

describe('CustomerPortalClaimsService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const customerId = '22222222-2222-2222-2222-222222222222';
  const otherCustomerId = '99999999-9999-9999-9999-999999999999';
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const claimId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const orderId = '55555555-5555-5555-5555-555555555555';

  function build() {
    let claim = {
      id: claimId,
      companyId,
      customerId,
      number: 'CLM-2026-0001',
      type: PtlClaimType.DELIVERY,
      status: PtlClaimStatus.OPEN,
      subject: 'Colis endommagé',
      description: 'Carton ouvert à la livraison',
      orderId: orderId as string | null,
      shipmentId: null as string | null,
      createdByUserId: userId,
      resolutionNote: null as string | null,
      version: 0,
      createdAt: new Date('2026-09-05T12:00:00.000Z'),
      updatedAt: new Date('2026-09-05T12:00:00.000Z'),
      deletedAt: null as Date | null,
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma: any = {
      ptlClaim: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([claim]),
        findFirst: jest.fn().mockImplementation(
          ({
            where,
          }: {
            where: { id?: string; customerId?: string };
          }) => {
            if (where?.id && where.id !== claimId) {
              return Promise.resolve(null);
            }
            if (where?.customerId && where.customerId !== customerId) {
              return Promise.resolve(null);
            }
            return Promise.resolve(claim);
          },
        ),
        create: jest.fn().mockImplementation(({ data }: { data: typeof claim }) => {
          claim = { ...claim, ...data, id: claimId };
          return Promise.resolve(claim);
        }),
      },
      salOrder: {
        findFirst: jest.fn().mockImplementation(
          ({ where }: { where: { id?: string; customerId?: string } }) => {
            if (where?.customerId === otherCustomerId) {
              return Promise.resolve(null);
            }
            if (where?.id === orderId) {
              return Promise.resolve({
                id: orderId,
                number: 'SO-PORTAL-SEED',
                customerId,
              });
            }
            return Promise.resolve(null);
          },
        ),
        findMany: jest.fn().mockResolvedValue([
          { id: orderId, number: 'SO-PORTAL-SEED' },
        ]),
      },
      dlvShipment: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const service = new CustomerPortalClaimsService(
      prisma as never,
      outbox as never,
    );
    return { service, prisma, outbox };
  }

  it('creates claim OPEN and enqueues outbox', async () => {
    const { service, outbox } = build();
    const dto = await service.create(companyId, customerId, userId, {
      type: PtlClaimType.DELIVERY,
      subject: 'Colis endommagé',
      description: 'Carton ouvert',
      orderId,
    });
    expect(dto.status).toBe(PtlClaimStatus.OPEN);
    expect(dto.number).toMatch(/^CLM-/);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'portals.claim.created.v1' }),
    );
  });

  it('rejects foreign order link as NOT_FOUND (IDOR)', async () => {
    const { service, prisma } = build();
    prisma.salOrder.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.create(companyId, customerId, userId, {
        type: PtlClaimType.OTHER,
        subject: 'x',
        description: 'y',
        orderId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: CUSTOMER_PORTAL_ERROR_CODES.NOT_FOUND },
    });
  });

  it('get returns NOT_FOUND for other customer claim', async () => {
    const { service } = build();
    await expect(
      service.get(companyId, otherCustomerId, claimId),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: CUSTOMER_PORTAL_ERROR_CODES.NOT_FOUND },
    });
  });

  it('lists scoped to membership customerId', async () => {
    const { service, prisma } = build();
    await service.list(companyId, customerId, { limit: 10 });
    expect(prisma.ptlClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId, customerId }),
      }),
    );
  });
});
