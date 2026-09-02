import { LicenseService } from './license.service';
import { signLicensePayload } from './license-crypto';
import {
  LICENSE_CACHE_KEY,
  LICENSE_ERROR_CODES,
  type LicensePayload,
} from './license.constants';
import { LicenseException } from './license.exception';

describe('LicenseService limits', () => {
  const basePayload: LicensePayload = {
    plan: 'demo',
    maxSites: 2,
    maxUsers: 3,
    expiresAt: '2027-12-31T23:59:59.000Z',
    issuedAt: '2026-01-01T00:00:00.000Z',
  };
  const signature = signLicensePayload(basePayload);

  let prisma: {
    orgSite: { count: jest.Mock };
    iamUser: { count: jest.Mock };
  };
  let redis: {
    getJson: jest.Mock;
    setJson: jest.Mock;
    del: jest.Mock;
  };
  let service: LicenseService;

  beforeEach(() => {
    prisma = {
      orgSite: { count: jest.fn().mockResolvedValue(0) },
      iamUser: { count: jest.fn().mockResolvedValue(0) },
    };
    redis = {
      getJson: jest.fn().mockImplementation((key: string) => {
        if (key !== LICENSE_CACHE_KEY) {
          return Promise.resolve(null);
        }
        return Promise.resolve({
          payload: basePayload,
          signature,
          status: 'active',
        });
      }),
      setJson: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new LicenseService(prisma as never, redis as never);
  });

  it('blocks site creation when the company site limit is reached', async () => {
    prisma.orgSite.count.mockResolvedValue(2);

    await expect(
      service.assertCanAddSite('company-demo'),
    ).rejects.toBeInstanceOf(LicenseException);
    await expect(
      service.assertCanAddSite('company-demo'),
    ).rejects.toMatchObject({
      code: LICENSE_ERROR_CODES.LIMIT_SITES,
    });
  });

  it('blocks user provisioning when the license user limit is reached', async () => {
    prisma.iamUser.count.mockResolvedValue(3);

    await expect(service.assertCanAddUser()).rejects.toBeInstanceOf(
      LicenseException,
    );
    await expect(service.assertCanAddUser()).rejects.toMatchObject({
      code: LICENSE_ERROR_CODES.LIMIT_USERS,
    });
  });
});
