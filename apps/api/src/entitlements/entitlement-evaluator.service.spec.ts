import { LICENSE_STATUSES } from '../license/license.constants';
import { LicenseException } from '../license/license.exception';
import { LICENSE_ERROR_CODES } from '../license/license.constants';
import { HttpStatus } from '@nestjs/common';
import { EntitlementEvaluatorService } from './entitlement-evaluator.service';

describe('EntitlementEvaluatorService', () => {
  const license = {
    getStatus: jest.fn(),
  };

  let service: EntitlementEvaluatorService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.THUNDER_ENTITLEMENT_DENY_MODULES;
    service = new EntitlementEvaluatorService(license as never);
  });

  it('allows module when license active and not denied', async () => {
    license.getStatus.mockResolvedValue({
      status: LICENSE_STATUSES.active,
      plan: 'premium',
      expiresAt: '2099-01-01T00:00:00.000Z',
      companyId: 'co-1',
    });

    const decision = await service.assertModule('co-1', 'sales');
    expect(decision.allowed).toBe(true);
    expect(decision.snapshot.source).toBe('license-stub');
  });

  it('denies module listed in THUNDER_ENTITLEMENT_DENY_MODULES', async () => {
    process.env.THUNDER_ENTITLEMENT_DENY_MODULES = 'sales,finance';
    license.getStatus.mockResolvedValue({
      status: LICENSE_STATUSES.active,
      plan: 'premium',
      expiresAt: '2099-01-01T00:00:00.000Z',
      companyId: 'co-1',
    });

    const decision = await service.assertModule('co-1', 'sales');
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe('ENT.DENIED');
  });

  it('rejects when license invalid', async () => {
    license.getStatus.mockRejectedValue(
      new LicenseException(
        LICENSE_ERROR_CODES.INVALID,
        'bad',
        HttpStatus.FORBIDDEN,
      ),
    );
    const decision = await service.assertModule('co-1', 'sales');
    expect(decision.allowed).toBe(false);
    expect(decision.snapshot.status).toBe('invalid');
  });
});
