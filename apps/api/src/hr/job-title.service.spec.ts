import { HttpStatus } from '@nestjs/common';
import { HR_ERROR_CODES } from './hr.constants';
import { JobTitleService, normalizeJobCode } from './job-title.service';

describe('JobTitleService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const jobTitleId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  function build() {
    const row = {
      id: jobTitleId,
      companyId,
      code: 'OPE',
      name: 'Opérateur',
      active: true,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null as Date | null,
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma: any = {
      hrJobTitle: {
        findMany: jest.fn().mockResolvedValue([row]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...row, ...data, id: jobTitleId }),
        ),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...row, ...data, version: 1, active: data.active ?? row.active }),
        ),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    const service = new JobTitleService(prisma as never, outbox as never);
    return { service, prisma, outbox, row };
  }

  it('normalizes codes to uppercase A-Z0-9 hyphen', () => {
    expect(normalizeJobCode('  opérateur atelier ')).toBe('OP-RATEUR-ATELIER');
  });

  it('creates a catalog row and emits outbox', async () => {
    const { service, outbox } = build();
    const dto = await service.create(companyId, {
      code: 'ope',
      name: 'Opérateur',
    });
    expect(dto.code).toBe('OPE');
    expect(dto.name).toBe('Opérateur');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'hr.job_title.created.v1' }),
    );
  });

  it('rejects duplicate codes', async () => {
    const { service, prisma, row } = build();
    prisma.hrJobTitle.findFirst = jest.fn().mockResolvedValue(row);
    await expect(
      service.create(companyId, { code: 'OPE', name: 'Autre' }),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: HR_ERROR_CODES.JOB_TITLE_CODE_EXISTS },
    });
  });

  it('archives via active=false', async () => {
    const { service, prisma, row } = build();
    prisma.hrJobTitle.findFirst = jest.fn().mockResolvedValue(row);
    const dto = await service.patch(companyId, jobTitleId, { active: false });
    expect(dto.active).toBe(false);
  });

  it('blocks assigning an archived title to a new employee', async () => {
    const { service, prisma, row } = build();
    prisma.hrJobTitle.findFirst = jest.fn().mockResolvedValue({
      ...row,
      active: false,
    });
    await expect(
      service.resolveAssignableId(companyId, jobTitleId),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: HR_ERROR_CODES.JOB_TITLE_INACTIVE },
    });
  });

  it('keeps a currently assigned archived title', async () => {
    const { service, prisma, row } = build();
    prisma.hrJobTitle.findFirst = jest.fn().mockResolvedValue({
      ...row,
      active: false,
    });
    await expect(
      service.resolveAssignableId(companyId, jobTitleId, jobTitleId),
    ).resolves.toBe(jobTitleId);
  });
});
