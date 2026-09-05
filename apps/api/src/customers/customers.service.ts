import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CusContact,
  CusCustomer,
  CusCustomerStatus,
  MdParty,
  MdPartyType,
  Prisma,
} from '@prisma/client';
import { MasterDataService } from '../master-data/master-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { CUSTOMERS_ERROR_CODES } from './customers.constants';
import { CustomersException } from './customers.exception';
import type {
  CreateContactDto,
  CreateCustomerDto,
  UpdateContactDto,
  UpdateCustomerDto,
} from './customers.dto';

export type ContactDto = {
  id: string;
  customerId: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  role: string | null;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CustomerDto = {
  id: string;
  companyId: string;
  partyId: string;
  code: string;
  legalName: string;
  taxId: string | null;
  salesRep: string | null;
  paymentTerms: string | null;
  status: CusCustomerStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  contacts?: ContactDto[];
};

type CustomerWithParty = CusCustomer & { party: MdParty };

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masterData: MasterDataService,
  ) {}

  async list(
    companyId: string,
    opts: { q?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: CustomerDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.CusCustomerWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { party: { legalName: { contains: q, mode: 'insensitive' } } },
        { salesRep: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.cusCustomer.findMany({
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
    return { items: page.map(serializeCustomer), nextCursor };
  }

  async get(companyId: string, id: string): Promise<CustomerDto> {
    const row = await this.findActive(companyId, id);
    const contacts = await this.prisma.cusContact.findMany({
      where: { companyId, customerId: id, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return {
      ...serializeCustomer(row),
      contacts: contacts.map(serializeContact),
    };
  }

  async create(companyId: string, dto: CreateCustomerDto): Promise<CustomerDto> {
    const code = dto.code.trim();
    if (!dto.partyId && !dto.legalName?.trim()) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.PARTY_NOT_FOUND,
        'legalName or partyId is required.',
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
            party.type !== MdPartyType.CUSTOMER &&
            party.type !== MdPartyType.BOTH
          ) {
            throw new CustomersException(
              CUSTOMERS_ERROR_CODES.PARTY_NOT_FOUND,
              'Party is not a customer party.',
              HttpStatus.BAD_REQUEST,
            );
          }
        } else {
          const party = await this.masterData.createParty(
            companyId,
            {
              type: MdPartyType.CUSTOMER,
              legalName: dto.legalName!.trim(),
              taxId: dto.taxId?.trim() || undefined,
            },
            tx,
          );
          partyId = party.id;
        }

        const customer = await tx.cusCustomer.create({
          data: {
            companyId,
            partyId: partyId!,
            code,
            salesRep: dto.salesRep?.trim() || null,
            paymentTerms: dto.paymentTerms?.trim() || null,
            status: CusCustomerStatus.ACTIVE,
          },
          include: { party: true },
        });

        const contactInputs = dto.contacts ?? [];
        if (contactInputs.length > 0) {
          await tx.cusContact.createMany({
            data: contactInputs.map((c) => ({
              companyId,
              customerId: customer.id,
              name: c.name.trim(),
              phone: c.phone?.trim() || null,
              whatsapp: c.whatsapp?.trim() || null,
              email: c.email?.trim() || null,
              role: c.role?.trim() || null,
            })),
          });
        }

        return customer;
      });

      return this.get(companyId, created.id);
    } catch (err) {
      if (err instanceof CustomersException) {
        throw err;
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const target = String(err.meta?.target ?? '');
        if (target.includes('party_id')) {
          throw new CustomersException(
            CUSTOMERS_ERROR_CODES.PARTY_DUP,
            'A customer already exists for this party.',
            HttpStatus.CONFLICT,
          );
        }
        throw new CustomersException(
          CUSTOMERS_ERROR_CODES.CODE_DUP,
          'Customer code already exists for this company.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerDto> {
    const row = await this.findActive(companyId, id);
    if (row.version !== dto.version) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
        'Customer version conflict.',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.legalName !== undefined || dto.taxId !== undefined) {
        await tx.mdParty.update({
          where: { id: row.partyId },
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

      const updated = await tx.cusCustomer.updateMany({
        where: { id, companyId, version: dto.version, deletedAt: null },
        data: {
          ...(dto.salesRep !== undefined
            ? { salesRep: dto.salesRep?.trim() || null }
            : {}),
          ...(dto.paymentTerms !== undefined
            ? { paymentTerms: dto.paymentTerms?.trim() || null }
            : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new CustomersException(
          CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
          'Customer version conflict.',
          HttpStatus.CONFLICT,
        );
      }
    });

    return this.get(companyId, id);
  }

  async softDelete(companyId: string, id: string): Promise<void> {
    const row = await this.findActive(companyId, id);
    await this.prisma.cusCustomer.update({
      where: { id: row.id },
      data: {
        status: CusCustomerStatus.INACTIVE,
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async addContact(
    companyId: string,
    customerId: string,
    dto: CreateContactDto,
  ): Promise<ContactDto> {
    await this.findActive(companyId, customerId);
    const row = await this.prisma.cusContact.create({
      data: {
        companyId,
        customerId,
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        whatsapp: dto.whatsapp?.trim() || null,
        email: dto.email?.trim() || null,
        role: dto.role?.trim() || null,
      },
    });
    return serializeContact(row);
  }

  async updateContact(
    companyId: string,
    customerId: string,
    contactId: string,
    dto: UpdateContactDto,
  ): Promise<ContactDto> {
    await this.findActive(companyId, customerId);
    const existing = await this.prisma.cusContact.findFirst({
      where: { id: contactId, companyId, customerId, deletedAt: null },
    });
    if (!existing) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.CONTACT_NOT_FOUND,
        'Contact not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.version !== dto.version) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
        'Contact version conflict.',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.cusContact.updateMany({
      where: {
        id: contactId,
        companyId,
        customerId,
        version: dto.version,
        deletedAt: null,
      },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.whatsapp !== undefined
          ? { whatsapp: dto.whatsapp?.trim() || null }
          : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
        ...(dto.role !== undefined ? { role: dto.role?.trim() || null } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
        'Contact version conflict.',
        HttpStatus.CONFLICT,
      );
    }
    const row = await this.prisma.cusContact.findUniqueOrThrow({
      where: { id: contactId },
    });
    return serializeContact(row);
  }

  async removeContact(
    companyId: string,
    customerId: string,
    contactId: string,
  ): Promise<void> {
    await this.findActive(companyId, customerId);
    const existing = await this.prisma.cusContact.findFirst({
      where: { id: contactId, companyId, customerId, deletedAt: null },
    });
    if (!existing) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.CONTACT_NOT_FOUND,
        'Contact not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.prisma.cusContact.update({
      where: { id: contactId },
      data: {
        active: false,
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<CustomerWithParty> {
    const row = await this.prisma.cusCustomer.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { party: true },
    });
    if (!row || row.party.deletedAt) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.NOT_FOUND,
        'Customer not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

function serializeCustomer(row: CustomerWithParty): CustomerDto {
  return {
    id: row.id,
    companyId: row.companyId,
    partyId: row.partyId,
    code: row.code,
    legalName: row.party.legalName,
    taxId: row.party.taxId,
    salesRep: row.salesRep,
    paymentTerms: row.paymentTerms,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeContact(row: CusContact): ContactDto {
  return {
    id: row.id,
    customerId: row.customerId,
    name: row.name,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    role: row.role,
    active: row.active,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
