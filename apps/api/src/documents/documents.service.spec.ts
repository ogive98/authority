import { HttpStatus } from '@nestjs/common';
import { DocLinkType, DocVisibility } from '@prisma/client';
import { DOCUMENTS_ERROR_CODES } from './documents.constants';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const userId = '99999999-9999-9999-9999-999999999999';
  const customerId = '22222222-2222-2222-2222-222222222222';
  const claimId = '33333333-3333-3333-3333-333333333333';
  const fileId = '44444444-4444-4444-4444-444444444444';
  const docId = '55555555-5555-5555-5555-555555555555';

  function build() {
    const files = {
      upload: jest.fn().mockResolvedValue({
        id: fileId,
        mime: 'application/pdf',
        size: 12,
        downloadUrl: 'https://example/signed',
        expiresInSeconds: 900,
      }),
      getDownloadUrl: jest.fn().mockResolvedValue({
        id: fileId,
        downloadUrl: 'https://example/signed',
        expiresInSeconds: 900,
      }),
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma: any = {
      ptlClaim: {
        findFirst: jest.fn().mockResolvedValue({ customerId }),
      },
      salOrder: { findFirst: jest.fn() },
      dlvShipment: { findFirst: jest.fn() },
      docDocument: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: docId,
            companyId,
            number: 'DOC-2026-0001',
            title: data.title,
            mime: data.mime,
            size: data.size,
            coreFileId: data.coreFileId,
            visibility: data.visibility,
            linkType: data.linkType,
            linkId: data.linkId,
            customerId: data.customerId,
            createdByUserId: data.createdByUserId,
            version: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          }),
        ),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };
    const service = new DocumentsService(
      prisma as never,
      files as never,
      outbox as never,
    );
    return { service, prisma, files, outbox };
  }

  it('uploads and links a claim document for portal visibility', async () => {
    const { service, files, outbox } = build();
    const dto = await service.createFromUpload(
      companyId,
      userId,
      {
        buffer: Buffer.from('hello world!'),
        mimetype: 'application/pdf',
        originalname: 'preuve.pdf',
      },
      {
        title: 'Preuve réclamation',
        visibility: DocVisibility.CUSTOMER_PORTAL,
        linkType: DocLinkType.CLAIM,
        linkId: claimId,
      },
    );
    expect(dto.number).toBe('DOC-2026-0001');
    expect(dto.customerId).toBe(customerId);
    expect(dto.visibility).toBe(DocVisibility.CUSTOMER_PORTAL);
    expect(files.upload).toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'documents.document.created.v1',
      }),
    );
  });

  it('portal download rejects wrong customer (IDOR)', async () => {
    const { service, prisma } = build();
    prisma.docDocument.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      service.getDownloadForCustomer(companyId, customerId, docId),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: DOCUMENTS_ERROR_CODES.NOT_FOUND },
    });
  });

  it('rejects empty title', async () => {
    const { service } = build();
    await expect(
      service.createFromUpload(
        companyId,
        userId,
        { buffer: Buffer.from('x'), mimetype: 'text/plain' },
        { title: '   ' },
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { code: DOCUMENTS_ERROR_CODES.TITLE_REQUIRED },
    });
  });
});
