import { MeFieldAclService } from './me-field-acl.service';
import { PERMISSION_KEYS } from '../permissions/permission.constants';

describe('MeFieldAclService', () => {
  function createService(opts: {
    companyId: string | null;
    wageAllowed: boolean;
  }) {
    const moduleRegistry = {
      resolveCompanyId: jest.fn().mockResolvedValue(opts.companyId),
    };
    const permissions = {
      evaluate: jest.fn((_userId: string, key: string) =>
        Promise.resolve(key === PERMISSION_KEYS.hrWageRead && opts.wageAllowed),
      ),
    };
    return {
      svc: new MeFieldAclService(moduleRegistry as never, permissions as never),
      permissions,
    };
  }

  it('masks hr.wage when hr.wage.read is denied', async () => {
    const { svc, permissions } = createService({
      companyId: 'co-1',
      wageAllowed: false,
    });
    const res = await svc.buildForUser('u1', {}, {});
    expect(res.fields).toEqual([
      {
        key: 'hr.wage',
        permissionKey: PERMISSION_KEYS.hrWageRead,
        visible: false,
      },
    ]);
    expect(permissions.evaluate).toHaveBeenCalledWith(
      'u1',
      PERMISSION_KEYS.hrWageRead,
      { companyId: 'co-1' },
    );
  });

  it('reveals hr.wage when hr.wage.read is allowed', async () => {
    const { svc } = createService({ companyId: 'co-1', wageAllowed: true });
    const res = await svc.buildForUser('u1', {}, {});
    expect(res.fields.find((f) => f.key === 'hr.wage')?.visible).toBe(true);
  });

  it('evaluates without company when context is null', async () => {
    const { svc, permissions } = createService({
      companyId: null,
      wageAllowed: false,
    });
    await svc.buildForUser('u1', {}, {});
    expect(permissions.evaluate).toHaveBeenCalledWith(
      'u1',
      PERMISSION_KEYS.hrWageRead,
      { companyId: undefined },
    );
  });
});
