import { AccountingGlMappingResolver } from './accounting-gl-mapping.resolver';
import { ACCOUNTING_SETTING_KEYS } from './accounting.constants';

describe('AccountingGlMappingResolver.companyBankGlOverride', () => {
  it('hides balance when company Prefs bank mapping unset', async () => {
    const prisma = {
      setDef: { upsert: jest.fn().mockResolvedValue({}) },
      setValue: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new AccountingGlMappingResolver(prisma as any);
    const r = await svc.companyBankGlOverride('c1');
    expect(r).toEqual({ configured: false, code: null });
    expect(prisma.setValue.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          defKey: ACCOUNTING_SETTING_KEYS.BANK,
        }),
      }),
    );
  });

  it('returns human Prefs bank code when set_value present', async () => {
    const prisma = {
      setDef: { upsert: jest.fn().mockResolvedValue({}) },
      setValue: {
        findFirst: jest.fn().mockResolvedValue({ valueJson: ' 5121 ' }),
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new AccountingGlMappingResolver(prisma as any);
    await expect(svc.companyBankGlOverride('c1')).resolves.toEqual({
      configured: true,
      code: '5121',
    });
  });
});
