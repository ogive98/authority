import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MdParty,
  MdPartyType,
  Prisma,
  SupContact,
  SupSupplier,
  SupSupplierCategory,
  SupSupplierStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { MasterDataService } from '../master-data/master-data.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SUPPLIERS_ERROR_CODES,
  SUPPLIERS_EVENT_TYPES,
  SUPPLIER_CATEGORIES,
  SUPPLIER_STATUSES,
} from './suppliers.constants';
import {
  CreateSupplierContactDto,
  CreateSupplierDto,
  SetSupplierHoldDto,
  UpdateSupplierDto,
} from './suppliers.dto';
import { SuppliersException } from './suppliers.exception';

export type SupplierContactDto = {
  id: string;
  supplierId: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  role: string | null;
  language: string | null;
  active: boolean;
  isPrimary: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type SupplierDto = {
  id: string;
  companyId: string;
  partyId: string;
  code: string;
  legalName: string;
  taxId: string | null;
  category: SupSupplierCategory;
  leadTimeDays: number | null;
  moqDefault: string | null;
  preferred: boolean;
  qualityHold: boolean;
  paymentTerms: string | null;
  notes: string | null;
  status: SupSupplierStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  contacts?: SupplierContactDto[];
};

type SupplierWithParty = SupSupplier & { party: MdParty };

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masterData: MasterDataService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    opts: { q?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: SupplierDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.SupSupplierWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { party: { legalName: { contains: q, mode: 'insensitive' } } },
        { paymentTerms: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.supSupplier.findMany({
      where,
      include: { party: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor
        ? {
            cursor: { id: opts.cursor },
            skip: 1,
          }
        : {}),
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    return { items: page.map(serializeSupplier), nextCursor };
  }

  async get(companyId: string, id: string): Promise<SupplierDto> {
    const row = await this.findActive(companyId, id);
    const contacts = await this.prisma.supContact.findMany({
      where: { companyId, supplierId: id, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return {
      ...serializeSupplier(row),
      contacts: contacts.map(serializeContact),
    };
  }

  async create(companyId: string, dto: CreateSupplierDto): Promise<SupplierDto> {
    const code = dto.code.trim();
    if (!dto.partyId && !dto.legalName?.trim()) {
      throw new SuppliersException(
        SUPPLIERS_ERROR_CODES.PARTY_NOT_FOUND,
        'legalName or partyId is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const category = parseCategory(dto.category);
    if (dto.leadTimeDays !== undefined && dto.leadTimeDays < 0) {
      throw new SuppliersException(
        SUPPLIERS_ERROR_CODES.INVALID_LEAD_TIME,
        'leadTimeDays must be >= 0.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.moqDefault !== undefined && dto.moqDefault < 0) {
      throw new SuppliersException(
        SUPPLIERS_ERROR_CODES.INVALID_MOQ,
        'moqDefault must be >= 0.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        let partyId = dto.partyId;
        if (partyId) {
          const party = await this.masterData.requireParty(
            companyId,
            partyId,
            tx,
          );
          if (
            party.type !== MdPartyType.SUPPLIER &&
            party.type !== MdPartyType.BOTH
          ) {
            throw new SuppliersException(
              SUPPLIERS_ERROR_CODES.PARTY_NOT_FOUND,
              'Party is not a supplier party.',
              HttpStatus.BAD_REQUEST,
            );
          }
        } else {
          const party = await this.masterData.createParty(
            companyId,
            {
              type: MdPartyType.SUPPLIER,
              legalName: dto.legalName!.trim(),
              taxId: dto.taxId?.trim() || undefined,
            },
            tx,
          );
          partyId = party.id;
        }

        const supplier = await tx.supSupplier.create({
          data: {
            companyId,
            partyId: partyId!,
            code,
            category,
            leadTimeDays: dto.leadTimeDays ?? null,
            moqDefault:
              dto.moqDefault !== undefined
                ? new Prisma.Decimal(dto.moqDefault)
                : null,
            preferred: dto.preferred ?? false,
            paymentTerms: dto.paymentTerms?.trim() || null,
            notes: dto.notes?.trim() || null,
            status: SupSupplierStatus.ACTIVE,
          },
          include: { party: true },
        });

        const contactInputs = dto.contacts ?? [];
        if (contactInputs.length > 0) {
          await tx.supContact.createMany({
            data: contactInputs.map((c) => ({
              companyId,
              supplierId: supplier.id,
              name: c.name.trim(),
              phone: c.phone?.trim() || null,
              whatsapp: c.whatsapp?.trim() || null,
              email: c.email?.trim() || null,
              role: c.role?.trim() || null,
              language: c.language?.trim() || null,
              isPrimary: c.isPrimary ?? false,
            })),
          });
        }

        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'sup_supplier',
          aggregateId: supplier.id,
          eventType: SUPPLIERS_EVENT_TYPES.SUPPLIER_CREATED,
          payloadJson: {
            supplierId: supplier.id,
            code: supplier.code,
            status: supplier.status,
            category: supplier.category,
          },
        });

        return supplier;
      });

      return this.get(companyId, created.id);
    } catch (err) {
      if (err instanceof SuppliersException) throw err;
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const target = String(err.meta?.target ?? '');
        if (target.includes('party_id')) {
          throw new SuppliersException(
            SUPPLIERS_ERROR_CODES.PARTY_DUP,
            'A supplier already exists for this party.',
            HttpStatus.CONFLICT,
          );
        }
        throw new SuppliersException(
          SUPPLIERS_ERROR_CODES.CODE_DUP,
          'Supplier code already exists.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateSupplierDto,
  ): Promise<SupplierDto> {
    const existing = await this.findActive(companyId, id);
    if (existing.version !== dto.version) {
      throw new SuppliersException(
        SUPPLIERS_ERROR_CODES.VERSION_CONFLICT,
        'Version conflict.',
        HttpStatus.CONFLICT,
        { currentVersion: existing.version },
      );
    }

    if (dto.status !== undefined && !isStatus(dto.status)) {
      throw new SuppliersException(
        SUPPLIERS_ERROR_CODES.INVALID_STATUS,
        'Invalid status.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.category !== undefined) {
      parseCategory(dto.category);
    }
    if (dto.leadTimeDays != null && dto.leadTimeDays < 0) {
      throw new SuppliersException(
        SUPPLIERS_ERROR_CODES.INVALID_LEAD_TIME,
        'leadTimeDays must be >= 0.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.moqDefault != null && dto.moqDefault < 0) {
      throw new SuppliersException(
        SUPPLIERS_ERROR_CODES.INVALID_MOQ,
        'moqDefault must be >= 0.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.legalName !== undefined || dto.taxId !== undefined) {
        await tx.mdParty.update({
          where: { id: existing.partyId },
          data: {
            ...(dto.legalName !== undefined
              ? { legalName: dto.legalName.trim() }
              : {}),
            ...(dto.taxId !== undefined
              ? { taxId: dto.taxId?.trim() || null }
              : {}),
            version: { increment: 1 },
          },
        });
      }

      await tx.supSupplier.update({
        where: { id },
        data: {
          ...(dto.category !== undefined
            ? { category: dto.category as SupSupplierCategory }
            : {}),
          ...(dto.leadTimeDays !== undefined
            ? { leadTimeDays: dto.leadTimeDays }
            : {}),
          ...(dto.moqDefault !== undefined
            ? {
                moqDefault:
                  dto.moqDefault === null
                    ? null
                    : new Prisma.Decimal(dto.moqDefault),
              }
            : {}),
          ...(dto.preferred !== undefined ? { preferred: dto.preferred } : {}),
          ...(dto.paymentTerms !== undefined
            ? { paymentTerms: dto.paymentTerms?.trim() || null }
            : {}),
          ...(dto.notes !== undefined
            ? { notes: dto.notes?.trim() || null }
            : {}),
          ...(dto.status !== undefined
            ? { status: dto.status as SupSupplierStatus }
            : {}),
          version: { increment: 1 },
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'sup_supplier',
        aggregateId: id,
        eventType: SUPPLIERS_EVENT_TYPES.SUPPLIER_UPDATED,
        payloadJson: { supplierId: id, version: dto.version + 1 },
      });
    });

    return this.get(companyId, id);
  }

  async setHold(
    companyId: string,
    id: string,
    dto: SetSupplierHoldDto,
  ): Promise<SupplierDto> {
    const existing = await this.findActive(companyId, id);
    if (existing.version !== dto.version) {
      throw new SuppliersException(
        SUPPLIERS_ERROR_CODES.VERSION_CONFLICT,
        'Version conflict.',
        HttpStatus.CONFLICT,
        { currentVersion: existing.version },
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.supSupplier.update({
        where: { id },
        data: {
          qualityHold: dto.qualityHold,
          ...(dto.qualityHold && dto.setOnHoldStatus
            ? { status: SupSupplierStatus.ON_HOLD }
            : !dto.qualityHold && existing.status === SupSupplierStatus.ON_HOLD
              ? { status: SupSupplierStatus.ACTIVE }
              : {}),
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'sup_supplier',
        aggregateId: id,
        eventType: SUPPLIERS_EVENT_TYPES.SUPPLIER_HOLD,
        payloadJson: {
          supplierId: id,
          qualityHold: dto.qualityHold,
        },
      });
    });

    return this.get(companyId, id);
  }

  async addContact(
    companyId: string,
    supplierId: string,
    dto: CreateSupplierContactDto,
  ): Promise<SupplierContactDto> {
    await this.findActive(companyId, supplierId);
    const row = await this.prisma.supContact.create({
      data: {
        companyId,
        supplierId,
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        whatsapp: dto.whatsapp?.trim() || null,
        email: dto.email?.trim() || null,
        role: dto.role?.trim() || null,
        language: dto.language?.trim() || null,
        isPrimary: dto.isPrimary ?? false,
      },
    });
    return serializeContact(row);
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<SupplierWithParty> {
    const row = await this.prisma.supSupplier.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { party: true },
    });
    if (!row) {
      throw new SuppliersException(
        SUPPLIERS_ERROR_CODES.NOT_FOUND,
        'Supplier not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

function parseCategory(
  raw: string | undefined,
): SupSupplierCategory {
  if (raw === undefined) return SupSupplierCategory.FOURNITURE;
  if (!(SUPPLIER_CATEGORIES as readonly string[]).includes(raw)) {
    throw new SuppliersException(
      SUPPLIERS_ERROR_CODES.INVALID_CATEGORY,
      'Invalid category.',
      HttpStatus.BAD_REQUEST,
    );
  }
  return raw as SupSupplierCategory;
}

function isStatus(v: string): boolean {
  return (SUPPLIER_STATUSES as readonly string[]).includes(v);
}

function serializeSupplier(row: SupplierWithParty): SupplierDto {
  return {
    id: row.id,
    companyId: row.companyId,
    partyId: row.partyId,
    code: row.code,
    legalName: row.party.legalName,
    taxId: row.party.taxId,
    category: row.category,
    leadTimeDays: row.leadTimeDays,
    moqDefault: row.moqDefault != null ? row.moqDefault.toFixed(3) : null,
    preferred: row.preferred,
    qualityHold: row.qualityHold,
    paymentTerms: row.paymentTerms,
    notes: row.notes,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeContact(row: SupContact): SupplierContactDto {
  return {
    id: row.id,
    supplierId: row.supplierId,
    name: row.name,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    role: row.role,
    language: row.language,
    active: row.active,
    isPrimary: row.isPrimary,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
