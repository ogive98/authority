import { HttpStatus } from '@nestjs/common';
import { DocLinkType, DocVisibility } from '@prisma/client';
import { HR_ERROR_CODES } from './hr.constants';
import { HrDocumentService } from './hr-document.service';

describe('HrDocumentService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const employeeId = '22222222-2222-2222-2222-222222222222';
  const otherEmployeeId = '33333333-3333-3333-3333-333333333333';
  const userId = '99999999-9999-9999-9999-999999999999';
  const docId = '55555555-5555-5555-5555-555555555555';

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
    const service = new HrDocumentService(
      prisma as never,
      documents as never,
      outbox as never,
    );
    return { service, prisma, documents, outbox, doc };
  }

  it('uploads INTERNAL HR_EMPLOYEE and emits outbox', async () => {
    const { service, documents, outbox } = build();
    const dto = await service.upload(
      companyId,
      userId,
      employeeId,
      {
        buffer: Buffer.from('cin'),
        mimetype: 'application/pdf',
        originalname: 'cin.pdf',
      },
      'CIN',
    );
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
        'x',
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
