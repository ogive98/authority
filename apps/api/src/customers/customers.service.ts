import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CusAddress,
  CusContact,
  CusCustomer,
  CusCustomerStatus,
  CusZone,
  MdParty,
  MdPartyType,
  Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { MasterDataService } from '../master-data/master-data.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CUSTOMERS_ERROR_CODES,
  CUSTOMERS_EVENT_TYPES,
} from './customers.constants';
import { CustomersException } from './customers.exception';
import {
  BlockCustomerDto,
  CreateAddressDto,
  CreateContactDto,
  CreateCustomerDto,
  CreateZoneDto,
  SetCreditDto,
  UnblockCustomerDto,
  UpdateAddressDto,
  UpdateContactDto,
  UpdateCustomerDto,
  UpsertCustomerPriceDto,
} from './customers.dto';

export type ContactDto = {
  id: string;
  customerId: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  role: string | null;
  language: string | null;
  active: boolean;
  isPrimary: boolean;
  canOrder: boolean;
  receiveInvoices: boolean;
  receiveDeliveryNotes: boolean;
  receiveNotifications: boolean;
  receiveDunning: boolean;
  portalAccess: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AddressDto = {
  id: string;
  customerId: string;
  type: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  governorate: string | null;
  postalCode: string | null;
  lat: string | null;
  lng: string | null;
  zoneHint: string | null;
  instructions: string | null;
  hours: string | null;
  contactName: string | null;
  contactPhone: string | null;
  routeHint: string | null;
  habitualDriver: string | null;
  isPrimary: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ZoneDto = {
  id: string;
  companyId: string;
  code: string;
  name: string;
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
  nickname: string | null;
  taxId: string | null;
  salesRep: string | null;
  paymentTerms: string | null;
  creditLimit: string | null;
  zoneId: string | null;
  zoneCode: string | null;
  zoneName: string | null;
  blocked: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  salubritaEmail: boolean;
  salubritaWhatsapp: boolean;
  salubritaPortal: boolean;
  enableCreditControl: boolean;
  alertBeforeCreditLimit: boolean;
  blockOnCreditLimit: boolean;
  allowExceptionalOverride: boolean;
  blockOnCriticalOverdue: boolean;
  notifyResponsible: boolean;
  creditStatus: string;
  fulfillmentDoc: 'DELIVERY_NOTE' | 'INVOICE';
  status: CusCustomerStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  contacts?: ContactDto[];
  addresses?: AddressDto[];
  prices?: CustomerPriceDto[];
};

export type CustomerPriceDto = {
  id: string;
  customerId: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  unitPriceHt: string;
  currency: string;
  version: number;
  updatedAt: string;
};

type CustomerWithParty = CusCustomer & {
  party: MdParty;
  zone?: CusZone | null;
};

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly masterData: MasterDataService,
    private readonly outbox: OutboxService,
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
        { nickname: { contains: q, mode: 'insensitive' } },
        { party: { legalName: { contains: q, mode: 'insensitive' } } },
        { salesRep: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.cusCustomer.findMany({
      where,
      include: { party: true, zone: true },
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
    const [contacts, addresses, prices] = await Promise.all([
      this.prisma.cusContact.findMany({
        where: { companyId, customerId: id, deletedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.cusAddress.findMany({
        where: { companyId, customerId: id, deletedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.listPrices(companyId, id),
    ]);
    return {
      ...serializeCustomer(row),
      contacts: contacts.map(serializeContact),
      addresses: addresses.map(serializeAddress),
      prices,
    };
  }

  async listPrices(
    companyId: string,
    customerId: string,
  ): Promise<CustomerPriceDto[]> {
    await this.findActive(companyId, customerId);
    const rows = await this.prisma.cusCustomerPrice.findMany({
      where: { companyId, customerId, deletedAt: null },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    if (rows.length === 0) return [];
    const productIds = [...new Set(rows.map((r) => r.productId))];
    const products = await this.prisma.prdProduct.findMany({
      where: { companyId, id: { in: productIds } },
      select: { id: true, sku: true, name: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    return rows.map((r) => {
      const p = byId.get(r.productId);
      return {
        id: r.id,
        customerId: r.customerId,
        productId: r.productId,
        productSku: p?.sku ?? null,
        productName: p?.name ?? null,
        unitPriceHt: r.unitPriceHt.toFixed(3),
        currency: r.currency,
        version: r.version,
        updatedAt: r.updatedAt.toISOString(),
      };
    });
  }

  async upsertPrice(
    companyId: string,
    customerId: string,
    dto: UpsertCustomerPriceDto,
  ): Promise<CustomerPriceDto> {
    await this.findActive(companyId, customerId);
    const product = await this.prisma.prdProduct.findFirst({
      where: {
        id: dto.productId,
        companyId,
        deletedAt: null,
      },
      select: { id: true, sku: true, name: true },
    });
    if (!product) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.PRODUCT_NOT_FOUND,
        'Product not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!Number.isFinite(dto.unitPriceHt) || dto.unitPriceHt < 0) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.PRICE_INVALID,
        'unitPriceHt must be a non-negative number.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const currency = (dto.currency?.trim() || 'TND').toUpperCase();
    const existing = await this.prisma.cusCustomerPrice.findUnique({
      where: {
        companyId_customerId_productId: {
          companyId,
          customerId,
          productId: dto.productId,
        },
      },
    });

    const row = existing
      ? await this.prisma.cusCustomerPrice.update({
          where: { id: existing.id },
          data: {
            unitPriceHt: new Prisma.Decimal(dto.unitPriceHt),
            currency,
            deletedAt: null,
            version: { increment: 1 },
          },
        })
      : await this.prisma.cusCustomerPrice.create({
          data: {
            companyId,
            customerId,
            productId: dto.productId,
            unitPriceHt: new Prisma.Decimal(dto.unitPriceHt),
            currency,
          },
        });

    return {
      id: row.id,
      customerId: row.customerId,
      productId: row.productId,
      productSku: product.sku,
      productName: product.name,
      unitPriceHt: row.unitPriceHt.toFixed(3),
      currency: row.currency,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async removePrice(
    companyId: string,
    customerId: string,
    productId: string,
  ): Promise<void> {
    await this.findActive(companyId, customerId);
    const existing = await this.prisma.cusCustomerPrice.findFirst({
      where: {
        companyId,
        customerId,
        productId,
        deletedAt: null,
      },
    });
    if (!existing) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.PRICE_NOT_FOUND,
        'Agreed price not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.prisma.cusCustomerPrice.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }

  /**
   * Portal / sales suggest: agreed price first, then last order line.
   */
  async resolveUnitPrices(
    companyId: string,
    customerId: string,
    productIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (productIds.length === 0) return result;

    const agreed = await this.prisma.cusCustomerPrice.findMany({
      where: {
        companyId,
        customerId,
        productId: { in: productIds },
        deletedAt: null,
      },
      select: { productId: true, unitPriceHt: true },
    });
    for (const row of agreed) {
      result.set(row.productId, Number(row.unitPriceHt));
    }

    const missing = productIds.filter((id) => !result.has(id));
    if (missing.length === 0) return result;

    const lines = await this.prisma.salOrderLine.findMany({
      where: {
        companyId,
        productId: { in: missing },
        order: {
          companyId,
          customerId,
          deletedAt: null,
        },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['productId'],
      select: { productId: true, unitPrice: true },
    });
    for (const line of lines) {
      if (!result.has(line.productId)) {
        result.set(line.productId, Number(line.unitPrice));
      }
    }
    return result;
  }

  async suggestUnitPrice(
    companyId: string,
    customerId: string,
    productId: string,
  ): Promise<{ unitPrice: string | null; source: 'agreed' | 'last' | null }> {
    await this.findActive(companyId, customerId);
    const agreed = await this.prisma.cusCustomerPrice.findFirst({
      where: {
        companyId,
        customerId,
        productId,
        deletedAt: null,
      },
      select: { unitPriceHt: true },
    });
    if (agreed) {
      return {
        unitPrice: agreed.unitPriceHt.toFixed(3),
        source: 'agreed',
      };
    }
    const map = await this.resolveUnitPrices(companyId, customerId, [
      productId,
    ]);
    const v = map.get(productId);
    if (v == null) return { unitPrice: null, source: null };
    return { unitPrice: v.toFixed(3), source: 'last' };
  }

  async listZones(companyId: string): Promise<ZoneDto[]> {
    const rows = await this.prisma.cusZone.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    });
    return rows.map(serializeZone);
  }

  async createZone(
    companyId: string,
    dto: CreateZoneDto,
  ): Promise<ZoneDto> {
    const code = dto.code.trim().toUpperCase();
    try {
      const row = await this.prisma.cusZone.create({
        data: {
          companyId,
          code,
          name: dto.name.trim(),
          active: true,
        },
      });
      return serializeZone(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new CustomersException(
          CUSTOMERS_ERROR_CODES.ZONE_CODE_DUP,
          'Zone code already exists for this company.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
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

    if (dto.zoneId) {
      await this.requireZone(companyId, dto.zoneId);
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
            nickname: dto.nickname?.trim() || null,
            salesRep: dto.salesRep?.trim() || null,
            paymentTerms: dto.paymentTerms?.trim() || null,
            creditLimit:
              dto.creditLimit !== undefined
                ? new Prisma.Decimal(dto.creditLimit)
                : null,
            zoneId: dto.zoneId ?? null,
            salubritaEmail: dto.salubritaEmail ?? false,
            salubritaWhatsapp: dto.salubritaWhatsapp ?? false,
            salubritaPortal: dto.salubritaPortal ?? true,
            ...(dto.fulfillmentDoc !== undefined
              ? { fulfillmentDoc: dto.fulfillmentDoc }
              : {}),
            status: CusCustomerStatus.ACTIVE,
          },
          include: { party: true, zone: true },
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
              language: c.language?.trim() || null,
              isPrimary: c.isPrimary ?? false,
              canOrder: c.canOrder ?? false,
              receiveInvoices: c.receiveInvoices ?? false,
              receiveDeliveryNotes: c.receiveDeliveryNotes ?? false,
              receiveNotifications: c.receiveNotifications ?? true,
              receiveDunning: c.receiveDunning ?? true,
              portalAccess: c.portalAccess ?? false,
            })),
          });
        }

        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'cus_customer',
          aggregateId: customer.id,
          eventType: CUSTOMERS_EVENT_TYPES.CUSTOMER_CREATED,
          payloadJson: {
            customerId: customer.id,
            code: customer.code,
            status: customer.status,
          },
        });

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

    if (dto.zoneId) {
      await this.requireZone(companyId, dto.zoneId);
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
          ...(dto.nickname !== undefined
            ? { nickname: dto.nickname?.trim() || null }
            : {}),
          ...(dto.salesRep !== undefined
            ? { salesRep: dto.salesRep?.trim() || null }
            : {}),
          ...(dto.paymentTerms !== undefined
            ? { paymentTerms: dto.paymentTerms?.trim() || null }
            : {}),
          ...(dto.zoneId !== undefined ? { zoneId: dto.zoneId } : {}),
          ...(dto.salubritaEmail !== undefined
            ? { salubritaEmail: dto.salubritaEmail }
            : {}),
          ...(dto.salubritaWhatsapp !== undefined
            ? { salubritaWhatsapp: dto.salubritaWhatsapp }
            : {}),
          ...(dto.salubritaPortal !== undefined
            ? { salubritaPortal: dto.salubritaPortal }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.enableCreditControl !== undefined
            ? { enableCreditControl: dto.enableCreditControl }
            : {}),
          ...(dto.alertBeforeCreditLimit !== undefined
            ? { alertBeforeCreditLimit: dto.alertBeforeCreditLimit }
            : {}),
          ...(dto.blockOnCreditLimit !== undefined
            ? { blockOnCreditLimit: dto.blockOnCreditLimit }
            : {}),
          ...(dto.allowExceptionalOverride !== undefined
            ? { allowExceptionalOverride: dto.allowExceptionalOverride }
            : {}),
          ...(dto.blockOnCriticalOverdue !== undefined
            ? { blockOnCriticalOverdue: dto.blockOnCriticalOverdue }
            : {}),
          ...(dto.notifyResponsible !== undefined
            ? { notifyResponsible: dto.notifyResponsible }
            : {}),
          ...(dto.fulfillmentDoc !== undefined
            ? { fulfillmentDoc: dto.fulfillmentDoc }
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

  async setCredit(
    companyId: string,
    id: string,
    dto: SetCreditDto,
  ): Promise<CustomerDto> {
    const row = await this.findActive(companyId, id);
    if (row.version !== dto.version) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
        'Customer version conflict.',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.cusCustomer.updateMany({
      where: { id, companyId, version: dto.version, deletedAt: null },
      data: {
        creditLimit: new Prisma.Decimal(dto.creditLimit),
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
    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'cus_customer',
        aggregateId: id,
        eventType: CUSTOMERS_EVENT_TYPES.CREDIT_CHANGED,
        payloadJson: {
          customerId: id,
          creditLimit: dto.creditLimit,
        },
      });
    });
    return this.get(companyId, id);
  }

  async block(
    companyId: string,
    id: string,
    dto: BlockCustomerDto,
  ): Promise<CustomerDto> {
    const row = await this.findActive(companyId, id);
    if (row.version !== dto.version) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
        'Customer version conflict.',
        HttpStatus.CONFLICT,
      );
    }
    if (row.blocked) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.ALREADY_BLOCKED,
        'Customer is already blocked.',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.cusCustomer.updateMany({
      where: {
        id,
        companyId,
        version: dto.version,
        deletedAt: null,
        blocked: false,
      },
      data: {
        blocked: true,
        blockedAt: new Date(),
        blockedReason: dto.reason?.trim() || null,
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
    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'cus_customer',
        aggregateId: id,
        eventType: CUSTOMERS_EVENT_TYPES.CUSTOMER_BLOCKED,
        payloadJson: {
          customerId: id,
          reason: dto.reason?.trim() || null,
        },
      });
    });
    return this.get(companyId, id);
  }

  async unblock(
    companyId: string,
    id: string,
    dto: UnblockCustomerDto,
  ): Promise<CustomerDto> {
    const row = await this.findActive(companyId, id);
    if (row.version !== dto.version) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
        'Customer version conflict.',
        HttpStatus.CONFLICT,
      );
    }
    if (!row.blocked) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.NOT_BLOCKED,
        'Customer is not blocked.',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.cusCustomer.updateMany({
      where: {
        id,
        companyId,
        version: dto.version,
        deletedAt: null,
        blocked: true,
      },
      data: {
        blocked: false,
        blockedAt: null,
        blockedReason: null,
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
    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'cus_customer',
        aggregateId: id,
        eventType: CUSTOMERS_EVENT_TYPES.CUSTOMER_UNBLOCKED,
        payloadJson: { customerId: id },
      });
    });
    return this.get(companyId, id);
  }

  async softDelete(companyId: string, id: string): Promise<void> {
    const row = await this.findActive(companyId, id);
    await this.prisma.cusCustomer.update({
      where: { id: row.id },
      data: {
        status: CusCustomerStatus.ARCHIVED,
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async listAddresses(
    companyId: string,
    customerId: string,
  ): Promise<AddressDto[]> {
    await this.findActive(companyId, customerId);
    const rows = await this.prisma.cusAddress.findMany({
      where: { companyId, customerId, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(serializeAddress);
  }

  async addAddress(
    companyId: string,
    customerId: string,
    dto: CreateAddressDto,
  ): Promise<AddressDto> {
    await this.findActive(companyId, customerId);
    const row = await this.prisma.cusAddress.create({
      data: {
        companyId,
        customerId,
        type: dto.type,
        label: dto.label?.trim() || null,
        line1: dto.line1.trim(),
        line2: dto.line2?.trim() || null,
        city: dto.city?.trim() || null,
        governorate: dto.governorate?.trim() || null,
        postalCode: dto.postalCode?.trim() || null,
        instructions: dto.instructions?.trim() || null,
        contactName: dto.contactName?.trim() || null,
        contactPhone: dto.contactPhone?.trim() || null,
        isPrimary: dto.isPrimary ?? false,
      },
    });
    return serializeAddress(row);
  }

  async updateAddress(
    companyId: string,
    customerId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<AddressDto> {
    await this.findActive(companyId, customerId);
    const existing = await this.prisma.cusAddress.findFirst({
      where: { id: addressId, companyId, customerId, deletedAt: null },
    });
    if (!existing) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.ADDRESS_NOT_FOUND,
        'Address not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.version !== dto.version) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
        'Address version conflict.',
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.prisma.cusAddress.updateMany({
      where: {
        id: addressId,
        companyId,
        customerId,
        version: dto.version,
        deletedAt: null,
      },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.label !== undefined
          ? { label: dto.label?.trim() || null }
          : {}),
        ...(dto.line1 !== undefined ? { line1: dto.line1.trim() } : {}),
        ...(dto.line2 !== undefined
          ? { line2: dto.line2?.trim() || null }
          : {}),
        ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
        ...(dto.governorate !== undefined
          ? { governorate: dto.governorate?.trim() || null }
          : {}),
        ...(dto.postalCode !== undefined
          ? { postalCode: dto.postalCode?.trim() || null }
          : {}),
        ...(dto.instructions !== undefined
          ? { instructions: dto.instructions?.trim() || null }
          : {}),
        ...(dto.contactName !== undefined
          ? { contactName: dto.contactName?.trim() || null }
          : {}),
        ...(dto.contactPhone !== undefined
          ? { contactPhone: dto.contactPhone?.trim() || null }
          : {}),
        ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
        'Address version conflict.',
        HttpStatus.CONFLICT,
      );
    }
    const row = await this.prisma.cusAddress.findUniqueOrThrow({
      where: { id: addressId },
    });
    return serializeAddress(row);
  }

  async removeAddress(
    companyId: string,
    customerId: string,
    addressId: string,
  ): Promise<void> {
    await this.findActive(companyId, customerId);
    const existing = await this.prisma.cusAddress.findFirst({
      where: { id: addressId, companyId, customerId, deletedAt: null },
    });
    if (!existing) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.ADDRESS_NOT_FOUND,
        'Address not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.prisma.cusAddress.update({
      where: { id: addressId },
      data: {
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
        language: dto.language?.trim() || null,
        isPrimary: dto.isPrimary ?? false,
        canOrder: dto.canOrder ?? false,
        receiveInvoices: dto.receiveInvoices ?? false,
        receiveDeliveryNotes: dto.receiveDeliveryNotes ?? false,
        receiveNotifications: dto.receiveNotifications ?? true,
        receiveDunning: dto.receiveDunning ?? true,
        portalAccess: dto.portalAccess ?? false,
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
        ...(dto.language !== undefined
          ? { language: dto.language?.trim() || null }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
        ...(dto.canOrder !== undefined ? { canOrder: dto.canOrder } : {}),
        ...(dto.receiveInvoices !== undefined
          ? { receiveInvoices: dto.receiveInvoices }
          : {}),
        ...(dto.receiveDeliveryNotes !== undefined
          ? { receiveDeliveryNotes: dto.receiveDeliveryNotes }
          : {}),
        ...(dto.receiveNotifications !== undefined
          ? { receiveNotifications: dto.receiveNotifications }
          : {}),
        ...(dto.receiveDunning !== undefined
          ? { receiveDunning: dto.receiveDunning }
          : {}),
        ...(dto.portalAccess !== undefined
          ? { portalAccess: dto.portalAccess }
          : {}),
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

  private async requireZone(companyId: string, zoneId: string): Promise<CusZone> {
    const zone = await this.prisma.cusZone.findFirst({
      where: { id: zoneId, companyId, deletedAt: null },
    });
    if (!zone) {
      throw new CustomersException(
        CUSTOMERS_ERROR_CODES.ZONE_NOT_FOUND,
        'Zone not found for this company.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return zone;
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<CustomerWithParty> {
    const row = await this.prisma.cusCustomer.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { party: true, zone: true },
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
    nickname: row.nickname,
    taxId: row.party.taxId,
    salesRep: row.salesRep,
    paymentTerms: row.paymentTerms,
    creditLimit: row.creditLimit != null ? row.creditLimit.toString() : null,
    zoneId: row.zoneId,
    zoneCode: row.zone?.code ?? null,
    zoneName: row.zone?.name ?? null,
    blocked: row.blocked,
    blockedAt: row.blockedAt ? row.blockedAt.toISOString() : null,
    blockedReason: row.blockedReason,
    salubritaEmail: row.salubritaEmail,
    salubritaWhatsapp: row.salubritaWhatsapp,
    salubritaPortal: row.salubritaPortal,
    enableCreditControl: row.enableCreditControl,
    alertBeforeCreditLimit: row.alertBeforeCreditLimit,
    blockOnCreditLimit: row.blockOnCreditLimit,
    allowExceptionalOverride: row.allowExceptionalOverride,
    blockOnCriticalOverdue: row.blockOnCriticalOverdue,
    notifyResponsible: row.notifyResponsible,
    creditStatus: row.creditStatus,
    fulfillmentDoc: row.fulfillmentDoc,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeZone(row: CusZone): ZoneDto {
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    name: row.name,
    active: row.active,
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
    language: row.language,
    active: row.active,
    isPrimary: row.isPrimary,
    canOrder: row.canOrder,
    receiveInvoices: row.receiveInvoices,
    receiveDeliveryNotes: row.receiveDeliveryNotes,
    receiveNotifications: row.receiveNotifications,
    receiveDunning: row.receiveDunning,
    portalAccess: row.portalAccess,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeAddress(row: CusAddress): AddressDto {
  return {
    id: row.id,
    customerId: row.customerId,
    type: row.type,
    label: row.label,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    governorate: row.governorate,
    postalCode: row.postalCode,
    lat: row.lat != null ? row.lat.toString() : null,
    lng: row.lng != null ? row.lng.toString() : null,
    zoneHint: row.zoneHint,
    instructions: row.instructions,
    hours: row.hours,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    routeHint: row.routeHint,
    habitualDriver: row.habitualDriver,
    isPrimary: row.isPrimary,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
