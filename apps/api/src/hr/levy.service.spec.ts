import { HttpStatus } from '@nestjs/common';
import { HR_ERROR_CODES } from './hr.constants';
import { LevyService } from './levy.service';

describe('LevyService', () => {
  const companyId = 'co-1';
  const contractId = 'c-1';

  function build(opts: {
    wageBase: string | null;
    tfp: { rateBps: number | null; lawRef: string | null } | null;
    foprolos: { rateBps: number | null; lawRef: string | null } | null;
  }) {
    const prisma = {
      hrContract: {
        findFirst: jest.fn().mockResolvedValue({
          id: contractId,
          employeeId: 'e-1',
          wageBase:
            opts.wageBase == null
              ? null
              : { toFixed: () => opts.wageBase },
        }),
      },
    };
    const expertise = {
      getHrContributionSnapshot: jest.fn().mockResolvedValue({
        tfp: opts.tfp,
        foprolos: opts.foprolos,
      }),
    };
    return {
      service: new LevyService(prisma as never, expertise as never),
      prisma,
    };
  }

  it('preview amounts null when Prefs empty — never invents rates', async () => {
    const { service } = build({
      wageBase: '1000.000',
      tfp: null,
      foprolos: null,
    });
    const preview = await service.preview(companyId, contractId);
    expect(preview.ready).toBe(false);
    expect(preview.tfp.amount).toBeNull();
    expect(preview.foprolos.amount).toBeNull();
    expect(preview.pending).toEqual(
      expect.arrayContaining(['hr.tfp', 'hr.foprolos']),
    );
    expect(preview.note).toContain('not deducted from bulletin net');
  });

  it('preview uses VALIDATED fixture bps only', async () => {
    const { service } = build({
      wageBase: '1000.000',
      tfp: { rateBps: 200, lawRef: 'x' },
      foprolos: { rateBps: 100, lawRef: 'y' },
    });
    const preview = await service.preview(companyId, contractId);
    expect(preview.tfp.amount).toBe(20);
    expect(preview.foprolos.amount).toBe(10);
    expect(preview.ready).toBe(true);
  });

  it('404 when contract missing', async () => {
    const prisma = {
      hrContract: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const expertise = { getHrContributionSnapshot: jest.fn() };
    const service = new LevyService(prisma as never, expertise as never);
    await expect(service.preview(companyId, contractId)).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: HR_ERROR_CODES.CONTRACT_NOT_FOUND },
    });
  });
});
