import { HttpStatus } from '@nestjs/common';
import { HrContractStatus, HrContractType, HrEmployeeStatus } from '@prisma/client';
import { HR_ERROR_CODES } from './hr.constants';
import { HrService } from './hr.service';

describe('HrService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const employeeId = '22222222-2222-2222-2222-222222222222';
  const contractId = '33333333-3333-3333-3333-333333333333';

  function build() {
    const employee = {
      id: employeeId,
      companyId,
      matricule: 'E-001',
      displayName: 'Amine Ben Ali',
      siteId: null as string | null,
      department: 'Production',
      jobTitle: 'Opérateur',
      cnssNo: '12345678',
      email: null as string | null,
      userId: null as string | null,
      status: HrEmployeeStatus.ACTIVE,
      hiredAt: new Date('2024-01-15T00:00:00.000Z'),
      leftAt: null as Date | null,
      notes: null as string | null,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null as Date | null,
      contracts: [] as unknown[],
    };

    const contract = {
      id: contractId,
      companyId,
      employeeId,
      number: 'CTR-2026-0001',
      type: HrContractType.CDI,
      status: HrContractStatus.ACTIVE,
      startDate: new Date('2024-01-15T00:00:00.000Z'),
      endDate: null as Date | null,
      wageRef: 'grille A',
      notes: null as string | null,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null as Date | null,
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma: any = {
      hrEmployee: {
        findMany: jest.fn().mockResolvedValue([{ ...employee, contracts: [contract] }]),
        findFirst: jest.fn().mockResolvedValue({ ...employee, contracts: [contract] }),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            ...employee,
            ...data,
            id: employeeId,
            contracts: [],
          }),
        ),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            ...employee,
            ...data,
            contracts: [contract],
            version: 1,
          }),
        ),
      },
      hrContract: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(contract),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...contract, ...data, id: contractId }),
        ),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...contract, ...data, version: 1 }),
        ),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const service = new HrService(prisma as never, outbox as never);
    return { service, prisma, outbox, employee, contract };
  }

  it('lists employees and masks wageRef without includeWage', async () => {
    const { service } = build();
    const { items } = await service.listEmployees(companyId, { includeWage: false });
    expect(items).toHaveLength(1);
    expect(items[0]!.matricule).toBe('E-001');
    expect(items[0]!.contracts[0]!.wageRef).toBeNull();
  });

  it('reveals wageRef when includeWage is true', async () => {
    const { service } = build();
    const { items } = await service.listEmployees(companyId, { includeWage: true });
    expect(items[0]!.contracts[0]!.wageRef).toBe('grille A');
  });

  it('creates employee and emits outbox event', async () => {
    const { service, prisma, outbox } = build();
    prisma.hrEmployee.findFirst = jest.fn().mockResolvedValue(null);
    const dto = await service.createEmployee(companyId, {
      matricule: 'e-002',
      displayName: 'Sara Trabelsi',
    });
    expect(dto.matricule).toBe('E-002');
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('rejects duplicate matricule', async () => {
    const { service } = build();
    await expect(
      service.createEmployee(companyId, {
        matricule: 'E-001',
        displayName: 'Dup',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: HR_ERROR_CODES.MATRICULE_EXISTS },
    });
  });

  it('ends an active contract', async () => {
    const { service } = build();
    const ended = await service.endContract(companyId, contractId, {
      endDate: '2026-09-01',
    });
    expect(ended.status).toBe(HrContractStatus.ENDED);
    expect(ended.endDate).toBe('2026-09-01');
  });
});
