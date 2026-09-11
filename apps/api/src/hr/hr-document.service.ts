import { HttpStatus, Injectable } from '@nestjs/common';
import { DocLinkType, DocVisibility } from '@prisma/client';
import { DocumentsService } from '../documents/documents.service';
import type { DocumentDownloadDto, DocumentDto } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../audit/outbox.service';
import { HR_ERROR_CODES, HR_EVENT_TYPES } from './hr.constants';
import { HrException } from './hr.exception';

/**
 * Employee dossier files via Documents (D209) — INTERNAL + HR_EMPLOYEE.
 * No parallel DMS. Portal never sees these (visibility INTERNAL).
 */
@Injectable()
export class HrDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    employeeId: string,
  ): Promise<{ items: DocumentDto[] }> {
    await this.assertEmployee(companyId, employeeId);
    const page = await this.documents.list(companyId, {
      linkType: DocLinkType.HR_EMPLOYEE,
      linkId: employeeId,
      visibility: DocVisibility.INTERNAL,
      limit: 100,
    });
    return { items: page.items };
  }

  async upload(
    companyId: string,
    actorUserId: string,
    employeeId: string,
    file: { buffer: Buffer; mimetype: string; originalname?: string },
    title?: string,
  ): Promise<DocumentDto> {
    await this.assertEmployee(companyId, employeeId);
    const resolvedTitle =
      title?.trim() || file?.originalname?.trim() || 'Document RH';
    const doc = await this.documents.createFromUpload(
      companyId,
      actorUserId,
      file,
      {
        title: resolvedTitle.slice(0, 200),
        visibility: DocVisibility.INTERNAL,
        linkType: DocLinkType.HR_EMPLOYEE,
        linkId: employeeId,
      },
    );
    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: HR_EVENT_TYPES.EMPLOYEE_DOCUMENT_ATTACHED,
        aggregateType: 'hr_employee',
        aggregateId: employeeId,
        payloadJson: {
          employeeId,
          documentId: doc.id,
          number: doc.number,
        },
      });
    });
    return doc;
  }

  async getDownload(
    companyId: string,
    employeeId: string,
    documentId: string,
  ): Promise<DocumentDownloadDto> {
    await this.assertLinkedDocument(companyId, employeeId, documentId);
    return this.documents.getDownloadUrl(companyId, documentId);
  }

  async getContent(
    companyId: string,
    employeeId: string,
    documentId: string,
  ): Promise<{ buffer: Buffer; mime: string; filename: string }> {
    await this.assertLinkedDocument(companyId, employeeId, documentId);
    return this.documents.getContent(companyId, documentId);
  }

  private async assertLinkedDocument(
    companyId: string,
    employeeId: string,
    documentId: string,
  ) {
    await this.assertEmployee(companyId, employeeId);
    const doc = await this.documents.get(companyId, documentId);
    if (
      doc.linkType !== DocLinkType.HR_EMPLOYEE ||
      doc.linkId !== employeeId ||
      doc.visibility !== DocVisibility.INTERNAL
    ) {
      throw new HrException(
        HR_ERROR_CODES.DOCUMENT_NOT_FOUND,
        'Document not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return doc;
  }

  private async assertEmployee(companyId: string, employeeId: string) {
    const row = await this.prisma.hrEmployee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.EMPLOYEE_NOT_FOUND,
        'Employee not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
