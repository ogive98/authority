import { HttpStatus, Injectable } from '@nestjs/common';
import {
  DocDocument,
  DocLinkType,
  DocVisibility,
  Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { FileService } from '../platform/file.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DOCUMENTS_ERROR_CODES,
  DOCUMENTS_EVENT_TYPES,
} from './documents.constants';
import type { CreateDocumentMetaDto } from './documents.dto';
import { DocumentsException } from './documents.exception';

export type DocumentDto = {
  id: string;
  companyId: string;
  number: string;
  title: string;
  mime: string;
  size: string;
  coreFileId: string;
  visibility: DocVisibility;
  linkType: DocLinkType;
  linkId: string | null;
  customerId: string | null;
  hrDocKindId: string | null;
  hrDocKind: { id: string; code: string; name: string } | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type DocumentDownloadDto = {
  id: string;
  number: string;
  title: string;
  downloadUrl: string;
  expiresInSeconds: number;
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FileService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    opts?: {
      q?: string;
      visibility?: string;
      customerId?: string;
      linkType?: string;
      linkId?: string;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ items: DocumentDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const q = opts?.q?.trim();
    const visibility = opts?.visibility?.trim().toUpperCase();
    const linkType = opts?.linkType?.trim().toUpperCase();

    const where: Prisma.DocDocumentWhereInput = {
      companyId,
      deletedAt: null,
      ...(opts?.customerId ? { customerId: opts.customerId } : {}),
      ...(opts?.linkId ? { linkId: opts.linkId } : {}),
      ...(visibility &&
      Object.values(DocVisibility).includes(visibility as DocVisibility)
        ? { visibility: visibility as DocVisibility }
        : {}),
      ...(linkType &&
      Object.values(DocLinkType).includes(linkType as DocLinkType)
        ? { linkType: linkType as DocLinkType }
        : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: 'insensitive' } },
              { title: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts?.cursor ? { id: { lt: opts.cursor } } : {}),
    };

    const rows = await this.prisma.docDocument.findMany({
      where,
      include: docKindInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
    return { items: page.map(serialize), nextCursor };
  }

  async get(companyId: string, id: string): Promise<DocumentDto> {
    return serialize(await this.findActive(companyId, id));
  }

  async createFromUpload(
    companyId: string,
    actorUserId: string,
    file: { buffer: Buffer; mimetype: string; originalname?: string },
    meta: CreateDocumentMetaDto,
  ): Promise<DocumentDto> {
    if (!file?.buffer?.length) {
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.FILE_REQUIRED,
        'File is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const title = meta.title?.trim();
    if (!title) {
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.TITLE_REQUIRED,
        'Title is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const visibility = meta.visibility ?? DocVisibility.INTERNAL;
    if (!Object.values(DocVisibility).includes(visibility)) {
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.INVALID_META,
        'Invalid visibility.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const linkType = meta.linkType ?? DocLinkType.NONE;
    if (!Object.values(DocLinkType).includes(linkType)) {
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.INVALID_META,
        'Invalid link type.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const linkId = meta.linkId?.trim() || null;
    if (linkType !== DocLinkType.NONE && !linkId) {
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.INVALID_LINK,
        'linkId is required for the selected link type.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const customerId = await this.resolveCustomerId(
      companyId,
      linkType,
      linkId,
    );

    let uploaded;
    try {
      uploaded = await this.files.upload({
        companyId,
        actorUserId,
        buffer: file.buffer,
        mime: file.mimetype || 'application/octet-stream',
        originalName: file.originalname,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Storage unavailable.';
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.STORAGE_UNAVAILABLE,
        message,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const number = await this.nextNumber(companyId);

    const row = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.docDocument.create({
        data: {
          companyId,
          number,
          title,
          mime: uploaded.mime,
          size: BigInt(uploaded.size),
          coreFileId: uploaded.id,
          visibility,
          linkType,
          linkId,
          customerId,
          createdByUserId: actorUserId,
          hrDocKindId: meta.hrDocKindId ?? null,
        },
        include: docKindInclude,
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'doc_document',
        aggregateId: doc.id,
        eventType: DOCUMENTS_EVENT_TYPES.CREATED,
        payloadJson: {
          documentId: doc.id,
          number: doc.number,
          coreFileId: doc.coreFileId,
          visibility: doc.visibility,
          linkType: doc.linkType,
          linkId: doc.linkId,
          customerId: doc.customerId,
          hrDocKindId: doc.hrDocKindId,
        },
      });

      return doc;
    });

    return serialize(row);
  }

  async getDownloadUrl(
    companyId: string,
    id: string,
  ): Promise<DocumentDownloadDto> {
    const doc = await this.findActive(companyId, id);
    const signed = await this.files.getDownloadUrl(doc.coreFileId, companyId);
    return {
      id: doc.id,
      number: doc.number,
      title: doc.title,
      downloadUrl: signed.downloadUrl,
      expiresInSeconds: signed.expiresInSeconds,
    };
  }

  async getContent(
    companyId: string,
    id: string,
  ): Promise<{ buffer: Buffer; mime: string; filename: string }> {
    const doc = await this.findActive(companyId, id);
    const file = await this.files.getBuffer(doc.coreFileId, companyId);
    const safe = doc.title.replace(/[^\w.\-]+/g, '_').slice(0, 80) || doc.number;
    return {
      buffer: file.buffer,
      mime: doc.mime || file.mime,
      filename: safe,
    };
  }

  /** Portal-scoped list: CUSTOMER_PORTAL + matching customerId. */
  async listForCustomer(
    companyId: string,
    customerId: string,
    opts?: {
      q?: string;
      limit?: number;
      cursor?: string;
      linkType?: string;
      linkId?: string;
    },
  ): Promise<{ items: DocumentDto[]; nextCursor: string | null }> {
    return this.list(companyId, {
      ...opts,
      customerId,
      visibility: DocVisibility.CUSTOMER_PORTAL,
    });
  }

  async listLinkTargets(
    companyId: string,
    opts: { linkType?: string; q?: string; limit?: number },
  ): Promise<{ items: Array<{ id: string; label: string; number: string }> }> {
    const linkType = opts.linkType?.trim().toUpperCase();
    if (
      !linkType ||
      !Object.values(DocLinkType).includes(linkType as DocLinkType) ||
      linkType === DocLinkType.NONE
    ) {
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.INVALID_META,
        'linkType must be CLAIM, ORDER, SHIPMENT, CUSTOMER, HR_BULLETIN, HR_EMPLOYEE, HR_CONTRACT, or HR_ATTESTATION.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 50);
    const q = opts.q?.trim();

    if (linkType === DocLinkType.CUSTOMER) {
      const rows = await this.prisma.cusCustomer.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...(q
            ? {
                OR: [
                  { code: { contains: q, mode: 'insensitive' } },
                  {
                    party: {
                      legalName: { contains: q, mode: 'insensitive' },
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ code: 'asc' }],
        take: limit,
        include: { party: { select: { legalName: true } } },
      });
      return {
        items: rows.map((r) => ({
          id: r.id,
          number: r.code,
          label: `${r.code} · ${r.party.legalName}`,
        })),
      };
    }

    if (linkType === DocLinkType.CLAIM) {
      const rows = await this.prisma.ptlClaim.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...(q
            ? {
                OR: [
                  { number: { contains: q, mode: 'insensitive' } },
                  { subject: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        select: { id: true, number: true, subject: true },
      });
      return {
        items: rows.map((r) => ({
          id: r.id,
          number: r.number,
          label: `${r.number} · ${r.subject}`,
        })),
      };
    }

    if (linkType === DocLinkType.ORDER) {
      const rows = await this.prisma.salOrder.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...(q
            ? { number: { contains: q, mode: 'insensitive' } }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        select: { id: true, number: true, status: true },
      });
      return {
        items: rows.map((r) => ({
          id: r.id,
          number: r.number,
          label: `${r.number} · ${r.status}`,
        })),
      };
    }

    if (linkType === DocLinkType.HR_EMPLOYEE) {
      const rows = await this.prisma.hrEmployee.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...(q
            ? {
                OR: [
                  { matricule: { contains: q, mode: 'insensitive' } },
                  { displayName: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        select: { id: true, matricule: true, displayName: true },
      });
      return {
        items: rows.map((r) => ({
          id: r.id,
          number: r.matricule,
          label: `${r.matricule} · ${r.displayName}`,
        })),
      };
    }

    if (linkType === DocLinkType.HR_BULLETIN) {
      const rows = await this.prisma.hrBulletin.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...(q ? { number: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        select: { id: true, number: true, periodYm: true },
      });
      return {
        items: rows.map((r) => ({
          id: r.id,
          number: r.number,
          label: `${r.number} · ${r.periodYm}`,
        })),
      };
    }

    if (linkType === DocLinkType.HR_CONTRACT) {
      const rows = await this.prisma.hrContract.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...(q ? { number: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        select: { id: true, number: true, type: true },
      });
      return {
        items: rows.map((r) => ({
          id: r.id,
          number: r.number,
          label: `${r.number} · ${r.type}`,
        })),
      };
    }

    if (linkType === DocLinkType.HR_ATTESTATION) {
      const rows = await this.prisma.hrEmployee.findMany({
        where: {
          companyId,
          deletedAt: null,
          ...(q
            ? {
                OR: [
                  { matricule: { contains: q, mode: 'insensitive' } },
                  { displayName: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        select: { id: true, matricule: true, displayName: true },
      });
      return {
        items: rows.map((r) => ({
          id: r.id,
          number: r.matricule,
          label: `${r.matricule} · ${r.displayName}`,
        })),
      };
    }

    if (linkType !== DocLinkType.SHIPMENT) {
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.INVALID_META,
        'linkType must be CLAIM, ORDER, SHIPMENT, CUSTOMER, HR_BULLETIN, HR_EMPLOYEE, HR_CONTRACT, or HR_ATTESTATION.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const rows = await this.prisma.dlvShipment.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(q ? { number: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      select: { id: true, number: true, status: true },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        number: r.number,
        label: `${r.number} · ${r.status}`,
      })),
    };
  }

  async getDownloadForCustomer(
    companyId: string,
    customerId: string,
    id: string,
  ): Promise<DocumentDownloadDto> {
    const doc = await this.prisma.docDocument.findFirst({
      where: {
        id,
        companyId,
        customerId,
        visibility: DocVisibility.CUSTOMER_PORTAL,
        deletedAt: null,
      },
    });
    if (!doc) {
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.NOT_FOUND,
        'Document not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const signed = await this.files.getDownloadUrl(doc.coreFileId, companyId);
    return {
      id: doc.id,
      number: doc.number,
      title: doc.title,
      downloadUrl: signed.downloadUrl,
      expiresInSeconds: signed.expiresInSeconds,
    };
  }

  /**
   * Portal upload: membership customer only, forced CUSTOMER_PORTAL visibility.
   * V0: CLAIM links only (assert claim belongs to customer).
   */
  async createFromPortalUpload(
    companyId: string,
    customerId: string,
    actorUserId: string,
    file: { buffer: Buffer; mimetype: string; originalname?: string },
    meta: { title: string; linkType: DocLinkType; linkId: string },
  ): Promise<DocumentDto> {
    if (!file?.buffer?.length) {
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.FILE_REQUIRED,
        'File is required.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const title = meta.title?.trim();
    if (!title) {
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.TITLE_REQUIRED,
        'Title is required.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (meta.linkType !== DocLinkType.CLAIM || !meta.linkId) {
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.INVALID_LINK,
        'Portal upload requires a CLAIM link.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const claim = await this.prisma.ptlClaim.findFirst({
      where: {
        id: meta.linkId,
        companyId,
        customerId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!claim) {
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.NOT_FOUND,
        'Document not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    let uploaded;
    try {
      uploaded = await this.files.upload({
        companyId,
        actorUserId,
        buffer: file.buffer,
        mime: file.mimetype || 'application/octet-stream',
        originalName: file.originalname,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Storage unavailable.';
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.STORAGE_UNAVAILABLE,
        message,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const number = await this.nextNumber(companyId);
    const row = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.docDocument.create({
        data: {
          companyId,
          number,
          title,
          mime: uploaded.mime,
          size: BigInt(uploaded.size),
          coreFileId: uploaded.id,
          visibility: DocVisibility.CUSTOMER_PORTAL,
          linkType: DocLinkType.CLAIM,
          linkId: claim.id,
          customerId,
          createdByUserId: actorUserId,
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'doc_document',
        aggregateId: doc.id,
        eventType: DOCUMENTS_EVENT_TYPES.CREATED,
        payloadJson: {
          documentId: doc.id,
          number: doc.number,
          coreFileId: doc.coreFileId,
          visibility: doc.visibility,
          linkType: doc.linkType,
          linkId: doc.linkId,
          customerId: doc.customerId,
          source: 'customer_portal',
        },
      });

      return doc;
    });

    return serialize(row);
  }

  private async resolveCustomerId(
    companyId: string,
    linkType: DocLinkType,
    linkId: string | null,
  ): Promise<string | null> {
    if (!linkId || linkType === DocLinkType.NONE) {
      return null;
    }

    if (linkType === DocLinkType.CLAIM) {
      const claim = await this.prisma.ptlClaim.findFirst({
        where: { id: linkId, companyId, deletedAt: null },
        select: { customerId: true },
      });
      if (!claim) {
        throw new DocumentsException(
          DOCUMENTS_ERROR_CODES.LINK_NOT_FOUND,
          'Claim not found for link.',
          HttpStatus.NOT_FOUND,
        );
      }
      return claim.customerId;
    }

    if (linkType === DocLinkType.ORDER) {
      const order = await this.prisma.salOrder.findFirst({
        where: { id: linkId, companyId, deletedAt: null },
        select: { customerId: true },
      });
      if (!order) {
        throw new DocumentsException(
          DOCUMENTS_ERROR_CODES.LINK_NOT_FOUND,
          'Order not found for link.',
          HttpStatus.NOT_FOUND,
        );
      }
      return order.customerId;
    }

    if (linkType === DocLinkType.SHIPMENT) {
      const shipment = await this.prisma.dlvShipment.findFirst({
        where: { id: linkId, companyId, deletedAt: null },
        select: { customerId: true },
      });
      if (!shipment) {
        throw new DocumentsException(
          DOCUMENTS_ERROR_CODES.LINK_NOT_FOUND,
          'Shipment not found for link.',
          HttpStatus.NOT_FOUND,
        );
      }
      return shipment.customerId;
    }

    if (linkType === DocLinkType.CUSTOMER) {
      const customer = await this.prisma.cusCustomer.findFirst({
        where: { id: linkId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!customer) {
        throw new DocumentsException(
          DOCUMENTS_ERROR_CODES.LINK_NOT_FOUND,
          'Customer not found for link.',
          HttpStatus.NOT_FOUND,
        );
      }
      return customer.id;
    }

    if (linkType === DocLinkType.HR_BULLETIN) {
      const bulletin = await this.prisma.hrBulletin.findFirst({
        where: { id: linkId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!bulletin) {
        throw new DocumentsException(
          DOCUMENTS_ERROR_CODES.LINK_NOT_FOUND,
          'Bulletin not found for link.',
          HttpStatus.NOT_FOUND,
        );
      }
      return null;
    }

    if (linkType === DocLinkType.HR_EMPLOYEE) {
      const employee = await this.prisma.hrEmployee.findFirst({
        where: { id: linkId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!employee) {
        throw new DocumentsException(
          DOCUMENTS_ERROR_CODES.LINK_NOT_FOUND,
          'Employee not found for link.',
          HttpStatus.NOT_FOUND,
        );
      }
      return null;
    }

    if (linkType === DocLinkType.HR_CONTRACT) {
      const contract = await this.prisma.hrContract.findFirst({
        where: { id: linkId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!contract) {
        throw new DocumentsException(
          DOCUMENTS_ERROR_CODES.LINK_NOT_FOUND,
          'Contract not found for link.',
          HttpStatus.NOT_FOUND,
        );
      }
      return null;
    }

    if (linkType === DocLinkType.HR_ATTESTATION) {
      const employee = await this.prisma.hrEmployee.findFirst({
        where: { id: linkId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!employee) {
        throw new DocumentsException(
          DOCUMENTS_ERROR_CODES.LINK_NOT_FOUND,
          'Employee not found for attestation link.',
          HttpStatus.NOT_FOUND,
        );
      }
      return null;
    }

    throw new DocumentsException(
      DOCUMENTS_ERROR_CODES.INVALID_LINK,
      'Invalid document link type.',
      HttpStatus.BAD_REQUEST,
    );
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<DocRow> {
    const row = await this.prisma.docDocument.findFirst({
      where: { id, companyId, deletedAt: null },
      include: docKindInclude,
    });
    if (!row) {
      throw new DocumentsException(
        DOCUMENTS_ERROR_CODES.NOT_FOUND,
        'Document not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DOC-${year}-`;
    const count = await this.prisma.docDocument.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }
}

const docKindInclude = {
  hrDocKind: {
    select: { id: true, code: true, name: true },
  },
} satisfies Prisma.DocDocumentInclude;

type DocRow = DocDocument & {
  hrDocKind: { id: string; code: string; name: string } | null;
};

function serialize(row: DocDocument | DocRow): DocumentDto {
  const kind =
    'hrDocKind' in row && row.hrDocKind
      ? {
          id: row.hrDocKind.id,
          code: row.hrDocKind.code,
          name: row.hrDocKind.name,
        }
      : null;
  return {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    title: row.title,
    mime: row.mime,
    size: row.size.toString(),
    coreFileId: row.coreFileId,
    visibility: row.visibility,
    linkType: row.linkType,
    linkId: row.linkId,
    customerId: row.customerId,
    hrDocKindId: row.hrDocKindId ?? null,
    hrDocKind: kind,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
