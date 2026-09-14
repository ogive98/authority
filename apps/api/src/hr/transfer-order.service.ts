import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinPaymentMethod,
  FinPaymentStatus,
  HrTransferOrderStatus,
  Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { HR_ERROR_CODES, HR_EVENT_TYPES } from './hr.constants';
import { HrException } from './hr.exception';
import { assertTunisianRib } from './rib-tn';
import {
  buildSepaFromTransferFacts,
  type SepaExportResult,
} from './sepa-pain001';

export type TransferBankAccountOption = {
  id: string;
  code: string;
  label: string;
  bankName: string | null;
  rib: string | null;
  isDefault: boolean;
};

export type TransferOrderDto = {
  id: string;
  companyId: string;
  number: string;
  bulletinId: string;
  bulletinNumber: string | null;
  periodYm: string | null;
  employeeId: string;
  employeeName: string | null;
  matricule: string | null;
  bankAccountId: string;
  amount: string;
  currency: string;
  status: HrTransferOrderStatus;
  beneficiaryName: string;
  beneficiaryBankName: string | null;
  beneficiaryBankAgency: string | null;
  beneficiaryBankAccount: string;
  companyBankCode: string;
  companyBankLabel: string;
  companyBankRib: string | null;
  apPaymentId: string | null;
  apPaymentNumber: string | null;
  pdfDocumentId: string | null;
  createdByUserId: string | null;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class TransferOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async listBankAccounts(
    companyId: string,
  ): Promise<{ items: TransferBankAccountOption[] }> {
    const rows = await this.prisma.finBankAccount.findMany({
      where: { companyId, deletedAt: null, active: true },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        code: r.code,
        label: r.label,
        bankName: r.bankName,
        rib: r.rib,
        isDefault: r.isDefault,
      })),
    };
  }

  async list(
    companyId: string,
    opts?: { bulletinId?: string; status?: string; limit?: number },
  ): Promise<{ items: TransferOrderDto[] }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const status = opts?.status?.trim().toUpperCase();
    const rows = await this.prisma.hrTransferOrder.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(opts?.bulletinId ? { bulletinId: opts.bulletinId } : {}),
        ...(status &&
        Object.values(HrTransferOrderStatus).includes(
          status as HrTransferOrderStatus,
        )
          ? { status: status as HrTransferOrderStatus }
          : {}),
      },
      include: {
        bulletin: { select: { number: true, periodYm: true } },
        employee: { select: { displayName: true, matricule: true } },
        apPayment: { select: { number: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });
    return { items: rows.map(serializeTransfer) };
  }

  async getById(companyId: string, id: string): Promise<TransferOrderDto> {
    const row = await this.prisma.hrTransferOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        bulletin: { select: { number: true, periodYm: true } },
        employee: { select: { displayName: true, matricule: true } },
        apPayment: { select: { number: true } },
      },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_NOT_FOUND,
        'Transfer order not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return serializeTransfer(row);
  }

  async create(
    companyId: string,
    input: { bulletinId: string; bankAccountId: string },
    actorUserId: string,
  ): Promise<TransferOrderDto> {
    const bulletin = await this.prisma.hrBulletin.findFirst({
      where: { id: input.bulletinId, companyId, deletedAt: null },
      include: {
        employee: {
          select: {
            id: true,
            displayName: true,
            matricule: true,
            bankName: true,
            bankAgency: true,
            bankAccount: true,
          },
        },
      },
    });
    if (!bulletin) {
      throw new HrException(
        HR_ERROR_CODES.BULLETIN_NOT_FOUND,
        'Bulletin not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const existing = await this.prisma.hrTransferOrder.findFirst({
      where: { bulletinId: bulletin.id, deletedAt: null },
    });
    if (existing) {
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_EXISTS,
        'A transfer order already exists for this bulletin.',
        HttpStatus.CONFLICT,
        { transferOrderId: existing.id },
      );
    }

    const net = Number(bulletin.netPay);
    if (!Number.isFinite(net) || net <= 0) {
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_AMOUNT_INVALID,
        'Bulletin netPay must be positive to create a transfer order.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const ribRaw = bulletin.employee.bankAccount?.trim();
    if (!ribRaw) {
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_BANK_REQUIRED,
        'Employee bank account (RIB) is required on the fiche.',
        HttpStatus.BAD_REQUEST,
      );
    }
    let rib: string;
    try {
      rib = assertTunisianRib(ribRaw);
    } catch (e) {
      throw new HrException(
        HR_ERROR_CODES.RIB_INVALID,
        e instanceof Error
          ? e.message
          : 'Employee RIB on the fiche is invalid.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const companyBank = await this.prisma.finBankAccount.findFirst({
      where: {
        id: input.bankAccountId,
        companyId,
        deletedAt: null,
        active: true,
      },
    });
    if (!companyBank) {
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_COMPANY_BANK_INVALID,
        'Company bank account not found or inactive.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const number = await this.nextNumber(companyId);
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.hrTransferOrder.create({
        data: {
          companyId,
          number,
          bulletinId: bulletin.id,
          employeeId: bulletin.employeeId,
          bankAccountId: companyBank.id,
          amount: bulletin.netPay,
          currency: bulletin.currency,
          status: HrTransferOrderStatus.DRAFT,
          beneficiaryName: bulletin.employee.displayName,
          beneficiaryBankName: bulletin.employee.bankName,
          beneficiaryBankAgency: bulletin.employee.bankAgency,
          beneficiaryBankAccount: rib,
          companyBankCode: companyBank.code,
          companyBankLabel: companyBank.label,
          companyBankRib: companyBank.rib,
          createdByUserId: actorUserId,
        },
        include: {
          bulletin: { select: { number: true, periodYm: true } },
          employee: { select: { displayName: true, matricule: true } },
          apPayment: { select: { number: true } },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'hr_transfer_order',
        aggregateId: created.id,
        eventType: HR_EVENT_TYPES.TRANSFER_CREATED,
        payloadJson: {
          transferOrderId: created.id,
          bulletinId: bulletin.id,
          amount: bulletin.netPay.toFixed(3),
          number,
        },
      });
      return created;
    });

    return serializeTransfer(row);
  }

  async confirm(
    companyId: string,
    id: string,
    actorUserId: string,
  ): Promise<TransferOrderDto> {
    const existing = await this.prisma.hrTransferOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        bulletin: { select: { number: true, periodYm: true } },
        employee: { select: { displayName: true, matricule: true } },
      },
    });
    if (!existing) {
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_NOT_FOUND,
        'Transfer order not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.status !== HrTransferOrderStatus.DRAFT) {
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_INVALID_STATUS,
        'Only DRAFT transfer orders can be confirmed.',
        HttpStatus.CONFLICT,
      );
    }

    const paymentDate = new Date();
    const paymentDateStr = paymentDate.toISOString().slice(0, 10);

    const row = await this.prisma.$transaction(async (tx) => {
      const apNumber = await this.nextApNumber(tx, companyId);
      const ap = await tx.finApPayment.create({
        data: {
          companyId,
          number: apNumber,
          vendorName: existing.beneficiaryName,
          amount: existing.amount,
          currency: existing.currency,
          method: FinPaymentMethod.BANK_TRANSFER,
          status: FinPaymentStatus.POSTED,
          paymentDate,
          accountingDate: paymentDate,
          reference: `HR-TO ${existing.number} · ${existing.bulletin.number}`,
          notes: `Ordre de virement salaire ${existing.number} (bulletin ${existing.bulletin.number})`,
        },
      });

      const updated = await tx.hrTransferOrder.update({
        where: { id: existing.id },
        data: {
          status: HrTransferOrderStatus.CONFIRMED,
          confirmedByUserId: actorUserId,
          confirmedAt: new Date(),
          apPaymentId: ap.id,
          version: { increment: 1 },
        },
        include: {
          bulletin: { select: { number: true, periodYm: true } },
          employee: { select: { displayName: true, matricule: true } },
          apPayment: { select: { number: true } },
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'hr_transfer_order',
        aggregateId: updated.id,
        eventType: HR_EVENT_TYPES.TRANSFER_CONFIRMED,
        payloadJson: {
          transferOrderId: updated.id,
          apPaymentId: ap.id,
          apPaymentNumber: ap.number,
          amount: existing.amount.toFixed(3),
          paymentDate: paymentDateStr,
        },
      });

      return updated;
    });

    return serializeTransfer(row);
  }

  async cancel(
    companyId: string,
    id: string,
    actorUserId: string,
  ): Promise<TransferOrderDto> {
    const existing = await this.prisma.hrTransferOrder.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_NOT_FOUND,
        'Transfer order not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.status !== HrTransferOrderStatus.DRAFT) {
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_INVALID_STATUS,
        'Only DRAFT transfer orders can be cancelled.',
        HttpStatus.CONFLICT,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.hrTransferOrder.update({
        where: { id },
        data: {
          status: HrTransferOrderStatus.CANCELLED,
          version: { increment: 1 },
        },
        include: {
          bulletin: { select: { number: true, periodYm: true } },
          employee: { select: { displayName: true, matricule: true } },
          apPayment: { select: { number: true } },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'hr_transfer_order',
        aggregateId: updated.id,
        eventType: HR_EVENT_TYPES.TRANSFER_CANCELLED,
        payloadJson: {
          transferOrderId: updated.id,
          cancelledByUserId: actorUserId,
        },
      });
      return updated;
    });

    return serializeTransfer(row);
  }

  /**
   * D240 — pain.001.001.03 XML from CONFIRMED order (frozen RIB → IBAN TN).
   * No BIC invent · no auto-send · company RIB required on the order snapshot.
   */
  async exportSepa(
    companyId: string,
    id: string,
    actorUserId: string,
  ): Promise<SepaExportResult> {
    const row = await this.prisma.hrTransferOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        bulletin: { select: { number: true, periodYm: true } },
      },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_NOT_FOUND,
        'Transfer order not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.status !== HrTransferOrderStatus.CONFIRMED) {
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_SEPA_STATUS,
        'Only CONFIRMED transfer orders can export SEPA / pain.001.',
        HttpStatus.CONFLICT,
      );
    }

    const companyRibRaw = row.companyBankRib?.trim();
    if (!companyRibRaw) {
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_SEPA_DEBTOR_RIB,
        'Company bank RIB is required on the transfer order to export SEPA. Set RIB on the société bank account and recreate the order if needed.',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      assertTunisianRib(companyRibRaw);
      assertTunisianRib(row.beneficiaryBankAccount);
    } catch (e) {
      throw new HrException(
        HR_ERROR_CODES.RIB_INVALID,
        e instanceof Error ? e.message : 'RIB on the transfer order is invalid.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const company = await this.prisma.orgCompany.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { legalName: true },
    });
    if (!company) {
      throw new HrException(
        HR_ERROR_CODES.NOT_FOUND,
        'Company not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const remittance = [
      'Salaire',
      row.number,
      row.bulletin.number,
      row.bulletin.periodYm,
    ]
      .filter(Boolean)
      .join(' · ');

    const result = buildSepaFromTransferFacts({
      transferNumber: row.number,
      companyLegalName: company.legalName,
      companyBankRib: companyRibRaw,
      beneficiaryName: row.beneficiaryName,
      beneficiaryBankAccount: row.beneficiaryBankAccount,
      amount: row.amount.toFixed(3),
      currency: row.currency,
      remittance,
    });

    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'hr_transfer_order',
        aggregateId: row.id,
        eventType: HR_EVENT_TYPES.TRANSFER_SEPA_EXPORTED,
        payloadJson: {
          transferOrderId: row.id,
          number: row.number,
          msgId: result.msgId,
          filename: result.filename,
          exportedByUserId: actorUserId,
        },
      });
    });

    return result;
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TO-${year}-`;
    const count = await this.prisma.hrTransferOrder.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async nextApNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `AP-${year}-`;
    const count = await tx.finApPayment.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }
}

function serializeTransfer(row: {
  id: string;
  companyId: string;
  number: string;
  bulletinId: string;
  employeeId: string;
  bankAccountId: string;
  amount: Prisma.Decimal;
  currency: string;
  status: HrTransferOrderStatus;
  beneficiaryName: string;
  beneficiaryBankName: string | null;
  beneficiaryBankAgency: string | null;
  beneficiaryBankAccount: string;
  companyBankCode: string;
  companyBankLabel: string;
  companyBankRib: string | null;
  apPaymentId: string | null;
  pdfDocumentId: string | null;
  createdByUserId: string | null;
  confirmedByUserId: string | null;
  confirmedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  bulletin?: { number: string; periodYm: string } | null;
  employee?: { displayName: string; matricule: string } | null;
  apPayment?: { number: string } | null;
}): TransferOrderDto {
  return {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    bulletinId: row.bulletinId,
    bulletinNumber: row.bulletin?.number ?? null,
    periodYm: row.bulletin?.periodYm ?? null,
    employeeId: row.employeeId,
    employeeName: row.employee?.displayName ?? null,
    matricule: row.employee?.matricule ?? null,
    bankAccountId: row.bankAccountId,
    amount: row.amount.toFixed(3),
    currency: row.currency,
    status: row.status,
    beneficiaryName: row.beneficiaryName,
    beneficiaryBankName: row.beneficiaryBankName,
    beneficiaryBankAgency: row.beneficiaryBankAgency,
    beneficiaryBankAccount: row.beneficiaryBankAccount,
    companyBankCode: row.companyBankCode,
    companyBankLabel: row.companyBankLabel,
    companyBankRib: row.companyBankRib,
    apPaymentId: row.apPaymentId,
    apPaymentNumber: row.apPayment?.number ?? null,
    pdfDocumentId: row.pdfDocumentId,
    createdByUserId: row.createdByUserId,
    confirmedByUserId: row.confirmedByUserId,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
