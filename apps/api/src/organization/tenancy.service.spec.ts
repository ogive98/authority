import { TenancyService } from './tenancy.service';
import { OrganizationException } from './organization.exception';
import { ORG_ERROR_CODES } from './organization.constants';

describe('TenancyService', () => {
  let service: TenancyService;
  let prisma: {
    orgUserAssignment: { findMany: jest.Mock; findFirst: jest.Mock };
    orgSite: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      orgUserAssignment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      orgSite: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
    };

    const licenseService = {
      assertCanAddSite: jest.fn().mockResolvedValue(undefined),
    };

    service = new TenancyService(prisma as never, licenseService as never);
  });

  it('denies access to unassigned company', async () => {
    prisma.orgUserAssignment.findFirst.mockResolvedValue(null);

    await expect(
      service.assertCompanyAccess('user-1', 'company-other'),
    ).rejects.toMatchObject({
      code: ORG_ERROR_CODES.CONTEXT_FORBIDDEN,
    });
  });

  it('allows access to assigned company', async () => {
    prisma.orgUserAssignment.findFirst.mockResolvedValue({
      company: { id: 'company-1', deletedAt: null },
    });

    await expect(
      service.assertCompanyAccess('user-1', 'company-1'),
    ).resolves.toBeUndefined();
  });

  it('rejects site outside company', async () => {
    prisma.orgUserAssignment.findFirst
      .mockResolvedValueOnce({
        company: { id: 'company-1', deletedAt: null },
      })
      .mockResolvedValueOnce({ siteId: null });
    prisma.orgSite.findFirst.mockResolvedValue(null);

    await expect(
      service.assertCompanyAccess('user-1', 'company-1', 'site-x'),
    ).rejects.toBeInstanceOf(OrganizationException);
  });
});
