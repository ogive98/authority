import { HttpStatus } from '@nestjs/common';
import { HrContractStatus, HrContractType, HrEmployeeStatus } from '@prisma/client';
import { HR_ERROR_CODES } from './hr.constants';
import { HrService } from './hr.service';
import { JobTitleService } from './job-title.service';

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
      jobTitleId: null as string | null,
      jobTitle: null as { id: string; name: string } | null,
      cnssNo: '12345678',
      email: null as string | null,
      userId: null as string | null,
      status: HrEmployeeStatus.ACTIVE,
      hiredAt: new Date('2024-01-15T00:00:00.000Z'),
      leftAt: null as Date | null,
      notes: null as string | null,
      taxChefDeFamille: null as boolean | null,
      taxEnfantCount: null as number | null,
      photoDocumentId: null as string | null,
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
      wageBase: null as unknown,
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
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          const next = {
            ...employee,
            ...data,
            contracts: [contract],
            version: 1,
          } as typeof employee & { photoDocument?: unknown };
          const photo = data.photoDocument as
            | { connect?: { id: string }; disconnect?: boolean }
            | undefined;
          if (photo?.connect?.id) next.photoDocumentId = photo.connect.id;
          if (photo?.disconnect) next.photoDocumentId = null;
          delete next.photoDocument;
          return Promise.resolve(next);
        }),
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
      hrJobTitle: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      docDocument: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const service = new HrService(
      prisma as never,
      outbox as never,
      new JobTitleService(prisma as never, outbox as never),
    );
    return { service, prisma, outbox, employee, contract };
  }

  it('returns a single employee by id', async () => {
    const { service } = build();
    const dto = await service.getEmployee(companyId, employeeId, false);
    expect(dto.id).toBe(employeeId);
    expect(dto.matricule).toBe('E-001');
  });

  it('patches hiredAt on the employee fiche', async () => {
    const { service } = build();
    const dto = await service.patchEmployee(companyId, employeeId, {
      hiredAt: '2025-03-01',
    });
    expect(dto.hiredAt).toBe('2025-03-01');
  });

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

  it('assigns a catalog job title on create', async () => {
    const { service, prisma } = build();
    const titleId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    prisma.hrEmployee.findFirst = jest.fn().mockResolvedValue(null);
    prisma.hrJobTitle.findFirst = jest.fn().mockResolvedValue({
      id: titleId,
      companyId,
      code: 'OPE',
      name: 'Opérateur',
      active: true,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    prisma.hrEmployee.create = jest.fn().mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: employeeId,
          companyId,
          matricule: data.matricule,
          displayName: data.displayName,
          siteId: null,
          department: null,
          jobTitleId: data.jobTitleId,
          jobTitle: { id: titleId, name: 'Opérateur' },
          cnssNo: null,
          email: null,
          userId: null,
          status: HrEmployeeStatus.ACTIVE,
          hiredAt: null,
          leftAt: null,
          notes: null,
          taxChefDeFamille: null,
          taxEnfantCount: null,
          photoDocumentId: null,
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          contracts: [],
        }),
    );
    const dto = await service.createEmployee(companyId, {
      matricule: 'e-003',
      displayName: 'Karim',
      jobTitleId: titleId,
    });
    expect(dto.jobTitleId).toBe(titleId);
    expect(dto.jobTitle).toBe('Opérateur');
  });

  it('ends an active contract', async () => {
    const { service } = build();
    const ended = await service.endContract(companyId, contractId, {
      endDate: '2026-09-01',
    });
    expect(ended.status).toBe(HrContractStatus.ENDED);
    expect(ended.endDate).toBe('2026-09-01');
  });

  it('sets photoDocumentId when the doc is an INTERNAL image linked to the employee', async () => {
    const { service, prisma } = build();
    const docId = '55555555-5555-5555-5555-555555555555';
    prisma.docDocument.findFirst = jest.fn().mockResolvedValue({
      id: docId,
      mime: 'image/jpeg',
    });
    const dto = await service.patchEmployee(companyId, employeeId, {
      photoDocumentId: docId,
    });
    expect(dto.photoDocumentId).toBe(docId);
  });

  it('rejects a non-image as employee photo', async () => {
    const { service, prisma } = build();
    prisma.docDocument.findFirst = jest.fn().mockResolvedValue({
      id: '55555555-5555-5555-5555-555555555555',
      mime: 'application/pdf',
    });
    await expect(
      service.patchEmployee(companyId, employeeId, {
        photoDocumentId: '55555555-5555-5555-5555-555555555555',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { code: HR_ERROR_CODES.PHOTO_INVALID },
    });
  });

  it('rejects a photo not linked to this employee', async () => {
    const { service, prisma } = build();
    prisma.docDocument.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      service.patchEmployee(companyId, employeeId, {
        photoDocumentId: '55555555-5555-5555-5555-555555555555',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { code: HR_ERROR_CODES.PHOTO_INVALID },
    });
  });

  it('clears photoDocumentId without deleting the document', async () => {
    const { service } = build();
    const dto = await service.patchEmployee(companyId, employeeId, {
      photoDocumentId: null,
    });
    expect(dto.photoDocumentId).toBeNull();
  });
});
