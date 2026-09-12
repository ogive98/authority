import { HttpStatus } from '@nestjs/common';
import { DocLinkType, DocVisibility } from '@prisma/client';
import { HR_ERROR_CODES } from './hr.constants';
import { HrDocumentService } from './hr-document.service';
import { DocKindService } from './doc-kind.service';

describe('HrDocumentService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const employeeId = '22222222-2222-2222-2222-222222222222';
  const otherEmployeeId = '33333333-3333-3333-3333-333333333333';
  const userId = '99999999-9999-9999-9999-999999999999';
  const docId = '55555555-5555-5555-5555-555555555555';
  const kindId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  function build() {
    const doc = {
      id: docId,
      companyId,
      number: 'DOC-2026-0001',
      title: 'CIN',
      mime: 'application/pdf',
      size: '12',
      coreFileId: 'file-1',
      visibility: DocVisibility.INTERNAL,
      linkType: DocLinkType.HR_EMPLOYEE,
      linkId: employeeId,
      customerId: null,
      hrDocKindId: null as string | null,
      hrDocKind: null,
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const documents = {
      list: jest.fn().mockResolvedValue({ items: [doc], nextCursor: null }),
      createFromUpload: jest.fn().mockResolvedValue(doc),
      get: jest.fn().mockResolvedValue(doc),
      getDownloadUrl: jest.fn().mockResolvedValue({
        id: docId,
        number: doc.number,
        title: doc.title,
        downloadUrl: 'https://example/signed',
        expiresInSeconds: 900,
      }),
      getContent: jest.fn().mockResolvedValue({
        buffer: Buffer.from('pdf'),
        mime: 'application/pdf',
        filename: 'CIN',
      }),
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma: any = {
      hrEmployee: {
        findFirst: jest.fn().mockResolvedValue({ id: employeeId }),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    const docKinds = {
      resolveAssignableId: jest.fn().mockResolvedValue(null),
    };
    const service = new HrDocumentService(
      prisma as never,
      documents as never,
      outbox as never,
      docKinds as never,
    );
    return { service, prisma, documents, outbox, doc, docKinds };
  }

  it('uploads INTERNAL HR_EMPLOYEE and emits outbox', async () => {
    const { service, documents, outbox } = build();
    const dto = await service.upload(companyId, userId, employeeId, {
      buffer: Buffer.from('cin'),
      mimetype: 'application/pdf',
      originalname: 'cin.pdf',
    }, { title: 'CIN' });
    expect(dto.linkType).toBe(DocLinkType.HR_EMPLOYEE);
    expect(documents.createFromUpload).toHaveBeenCalledWith(
      companyId,
      userId,
      expect.anything(),
      expect.objectContaining({
        visibility: DocVisibility.INTERNAL,
        linkType: DocLinkType.HR_EMPLOYEE,
        linkId: employeeId,
        title: 'CIN',
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'hr.employee.document.attached.v1',
      }),
    );
  });

  it('passes resolved kindId to Documents on upload', async () => {
    const { service, documents, docKinds, doc } = build();
    docKinds.resolveAssignableId = jest.fn().mockResolvedValue(kindId);
    documents.createFromUpload = jest.fn().mockResolvedValue({
      ...doc,
      hrDocKindId: kindId,
      hrDocKind: { id: kindId, code: 'CIN', name: 'Carte identité' },
    });
    await service.upload(
      companyId,
      userId,
      employeeId,
      { buffer: Buffer.from('cin'), mimetype: 'application/pdf' },
      { title: 'CIN', kindId },
    );
    expect(docKinds.resolveAssignableId).toHaveBeenCalledWith(
      companyId,
      kindId,
    );
    expect(documents.createFromUpload).toHaveBeenCalledWith(
      companyId,
      userId,
      expect.anything(),
      expect.objectContaining({ hrDocKindId: kindId }),
    );
  });

  it('rejects invalid kind via DocKindService', async () => {
    const { service, docKinds } = build();
    docKinds.resolveAssignableId = jest.fn().mockRejectedValue(
      Object.assign(new Error('bad'), {
        status: HttpStatus.BAD_REQUEST,
        response: { code: HR_ERROR_CODES.DOC_KIND_NOT_FOUND },
      }),
    );
    await expect(
      service.upload(
        companyId,
        userId,
        employeeId,
        { buffer: Buffer.from('x'), mimetype: 'text/plain' },
        { kindId },
      ),
    ).rejects.toMatchObject({
      response: { code: HR_ERROR_CODES.DOC_KIND_NOT_FOUND },
    });
  });

  it('download IDOR rejects a doc linked to another employee', async () => {
    const { service, documents, doc } = build();
    documents.get = jest.fn().mockResolvedValue({
      ...doc,
      linkId: otherEmployeeId,
    });
    await expect(
      service.getDownload(companyId, employeeId, docId),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: HR_ERROR_CODES.DOCUMENT_NOT_FOUND },
    });
  });

  it('rejects upload when employee is missing', async () => {
    const { service, prisma } = build();
    prisma.hrEmployee.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      service.upload(
        companyId,
        userId,
        employeeId,
        { buffer: Buffer.from('x'), mimetype: 'text/plain' },
        { title: 'x' },
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: HR_ERROR_CODES.EMPLOYEE_NOT_FOUND },
    });
  });

  it('content IDOR rejects a doc linked to another employee', async () => {
    const { service, documents, doc } = build();
    documents.get = jest.fn().mockResolvedValue({
      ...doc,
      linkId: otherEmployeeId,
    });
    await expect(
      service.getContent(companyId, employeeId, docId),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: HR_ERROR_CODES.DOCUMENT_NOT_FOUND },
    });
  });

  it('streams content after IDOR check', async () => {
    const { service, documents } = build();
    const file = await service.getContent(companyId, employeeId, docId);
    expect(file.mime).toBe('application/pdf');
    expect(documents.getContent).toHaveBeenCalledWith(companyId, docId);
  });
});

describe('DocKindService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';

  it('creates a kind without seeding defaults', async () => {
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma: any = {
      hrDocKind: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'k1',
            companyId,
            ...data,
            version: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          }),
        ),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    const service = new DocKindService(prisma as never, outbox as never);
    const dto = await service.create(companyId, {
      code: 'cin',
      name: 'Carte d’identité',
    });
    expect(dto.code).toBe('CIN');
    expect(dto.name).toBe('Carte d’identité');
    expect(prisma.hrDocKind.create).toHaveBeenCalled();
  });
});
