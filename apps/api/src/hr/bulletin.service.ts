import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { currentPeriodYm, normalizePeriodYm } from './cnss-calc';
import { HR_ERROR_CODES, HR_EVENT_TYPES } from './hr.constants';
import { HrException } from './hr.exception';

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export type BulletinPreviewDto = {
  contractId: string;
  employeeId: string;
  employeeName: string;
  matricule: string;
  contractNumber: string;
  periodYm: string;
  wageBase: number | null;
  cnssEmployeeAmount: number | null;
  cnssEmployerAmount: number | null;
  irppMonthly: number | null;
  netPay: number | null;
  cnssSnapshotId: string | null;
  irppSnapshotId: string | null;
  ready: boolean;
  pending: string[];
  currency: 'TND';
};

export type BulletinDto = {
  id: string;
  companyId: string;
  periodYm: string;
  employeeId: string;
  contractId: string;
  number: string;
  wageBase: string;
  cnssEmployeeAmount: string;
  cnssEmployerAmount: string;
  irppMonthly: string;
  netPay: string;
  cnssSnapshotId: string | null;
  irppSnapshotId: string | null;
  currency: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  employeeName: string | null;
  matricule: string | null;
  contractNumber: string | null;
};

@Injectable()
export class BulletinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async preview(
    companyId: string,
    contractId: string,
    periodYmRaw?: string,
  ): Promise<BulletinPreviewDto> {
    const periodYm =
      (periodYmRaw ? normalizePeriodYm(periodYmRaw) : null) ??
      currentPeriodYm();
    if (periodYmRaw && !normalizePeriodYm(periodYmRaw)) {
      throw new HrException(
        HR_ERROR_CODES.BULLETIN_INVALID_PERIOD,
        'periodYm must be YYYY-MM.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.compose(companyId, contractId, periodYm);
  }

  async create(
    companyId: string,
    input: { contractId: string; periodYm?: string },
  ): Promise<BulletinDto> {
    const periodYm =
      (input.periodYm ? normalizePeriodYm(input.periodYm) : null) ??
      currentPeriodYm();
    if (input.periodYm && !normalizePeriodYm(input.periodYm)) {
      throw new HrException(
        HR_ERROR_CODES.BULLETIN_INVALID_PERIOD,
        'periodYm must be YYYY-MM.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const composed = await this.compose(companyId, input.contractId, periodYm);
    if (
      !composed.ready ||
      composed.wageBase == null ||
      composed.cnssEmployeeAmount == null ||
      composed.cnssEmployerAmount == null ||
      composed.irppMonthly == null ||
      composed.netPay == null
    ) {
      throw new HrException(
        HR_ERROR_CODES.BULLETIN_SNAPSHOTS_PENDING,
        'Bulletin requires CNSS + IRPP snapshots for this contract and period.',
        HttpStatus.CONFLICT,
        { pending: composed.pending },
      );
    }

    const existing = await this.prisma.hrBulletin.findFirst({
      where: {
        companyId,
        periodYm,
        contractId: input.contractId,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new HrException(
        HR_ERROR_CODES.BULLETIN_EXISTS,
        'A bulletin already exists for this contract and period.',
        HttpStatus.CONFLICT,
        { bulletinId: existing.id },
      );
    }

    const seq = await this.prisma.hrBulletin.count({
      where: { companyId, periodYm },
    });
    const number = `BUL-${periodYm}-${String(seq + 1).padStart(4, '0')}`;

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.hrBulletin.create({
        data: {
          companyId,
          periodYm,
          employeeId: composed.employeeId,
          contractId: composed.contractId,
          number,
          wageBase: new Prisma.Decimal(composed.wageBase!),
          cnssEmployeeAmount: new Prisma.Decimal(composed.cnssEmployeeAmount!),
          cnssEmployerAmount: new Prisma.Decimal(composed.cnssEmployerAmount!),
          irppMonthly: new Prisma.Decimal(composed.irppMonthly!),
          netPay: new Prisma.Decimal(composed.netPay!),
          cnssSnapshotId: composed.cnssSnapshotId,
          irppSnapshotId: composed.irppSnapshotId,
        },
        include: {
          employee: { select: { displayName: true, matricule: true } },
          contract: { select: { number: true } },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'hr_bulletin',
        aggregateId: created.id,
        eventType: HR_EVENT_TYPES.BULLETIN_CREATED,
        payloadJson: {
          bulletinId: created.id,
          number,
          periodYm,
          contractId: composed.contractId,
          employeeId: composed.employeeId,
          netPay: composed.netPay,
        },
      });
      return created;
    });

    return serializeBulletin(row);
  }

  async list(
    companyId: string,
    opts?: { periodYm?: string; employeeId?: string; limit?: number },
  ): Promise<{ items: BulletinDto[] }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const periodYm = opts?.periodYm
      ? normalizePeriodYm(opts.periodYm)
      : undefined;
    if (opts?.periodYm && !periodYm) {
      throw new HrException(
        HR_ERROR_CODES.BULLETIN_INVALID_PERIOD,
        'periodYm must be YYYY-MM.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const rows = await this.prisma.hrBulletin.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(periodYm ? { periodYm } : {}),
        ...(opts?.employeeId ? { employeeId: opts.employeeId } : {}),
      },
      include: {
        employee: { select: { displayName: true, matricule: true } },
        contract: { select: { number: true } },
      },
      orderBy: [{ periodYm: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return { items: rows.map(serializeBulletin) };
  }

  async getById(companyId: string, id: string): Promise<BulletinDto> {
    const row = await this.prisma.hrBulletin.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        employee: { select: { displayName: true, matricule: true } },
        contract: { select: { number: true } },
      },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.BULLETIN_NOT_FOUND,
        'Bulletin not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return serializeBulletin(row);
  }

  private async compose(
    companyId: string,
    contractId: string,
    periodYm: string,
  ): Promise<BulletinPreviewDto> {
    const contract = await this.prisma.hrContract.findFirst({
      where: { id: contractId, companyId, deletedAt: null },
      include: { employee: true },
    });
    if (!contract) {
      throw new HrException(
        HR_ERROR_CODES.CONTRACT_NOT_FOUND,
        'Contract not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const [cnss, irpp] = await Promise.all([
      this.prisma.hrCnssSnapshot.findFirst({
        where: {
          companyId,
          periodYm,
          contractId,
          deletedAt: null,
        },
      }),
      this.prisma.hrIrppSnapshot.findFirst({
        where: {
          companyId,
          periodYm,
          contractId,
          deletedAt: null,
        },
      }),
    ]);

    const pending: string[] = [];
    if (!cnss) pending.push('cnss.snapshot');
    if (!irpp) pending.push('irpp.snapshot');

    const wageBase = cnss
      ? Number(cnss.wageBase.toFixed(3))
      : contract.wageBase
        ? Number(contract.wageBase.toFixed(3))
        : null;
    const cnssEmployeeAmount = cnss?.employeeAmount
      ? Number(cnss.employeeAmount.toFixed(3))
      : null;
    const cnssEmployerAmount = cnss?.employerAmount
      ? Number(cnss.employerAmount.toFixed(3))
      : null;
    const irppMonthly = irpp
      ? Number(irpp.monthlyIrpp.toFixed(3))
      : null;

    let netPay: number | null = null;
    if (
      wageBase != null &&
      cnssEmployeeAmount != null &&
      irppMonthly != null
    ) {
      netPay = round3(wageBase - cnssEmployeeAmount - irppMonthly);
    }

    return {
      contractId: contract.id,
      employeeId: contract.employeeId,
      employeeName: contract.employee.displayName,
      matricule: contract.employee.matricule,
      contractNumber: contract.number,
      periodYm,
      wageBase,
      cnssEmployeeAmount,
      cnssEmployerAmount,
      irppMonthly,
      netPay,
      cnssSnapshotId: cnss?.id ?? null,
      irppSnapshotId: irpp?.id ?? null,
      ready: pending.length === 0 && netPay != null,
      pending,
      currency: 'TND',
    };
  }
}

function serializeBulletin(row: {
  id: string;
  companyId: string;
  periodYm: string;
  employeeId: string;
  contractId: string;
  number: string;
  wageBase: Prisma.Decimal;
  cnssEmployeeAmount: Prisma.Decimal;
  cnssEmployerAmount: Prisma.Decimal;
  irppMonthly: Prisma.Decimal;
  netPay: Prisma.Decimal;
  cnssSnapshotId: string | null;
  irppSnapshotId: string | null;
  currency: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  employee?: { displayName: string; matricule: string } | null;
  contract?: { number: string } | null;
}): BulletinDto {
  return {
    id: row.id,
    companyId: row.companyId,
    periodYm: row.periodYm,
    employeeId: row.employeeId,
    contractId: row.contractId,
    number: row.number,
    wageBase: row.wageBase.toFixed(3),
    cnssEmployeeAmount: row.cnssEmployeeAmount.toFixed(3),
    cnssEmployerAmount: row.cnssEmployerAmount.toFixed(3),
    irppMonthly: row.irppMonthly.toFixed(3),
    netPay: row.netPay.toFixed(3),
    cnssSnapshotId: row.cnssSnapshotId,
    irppSnapshotId: row.irppSnapshotId,
    currency: row.currency,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    employeeName: row.employee?.displayName ?? null,
    matricule: row.employee?.matricule ?? null,
    contractNumber: row.contract?.number ?? null,
  };
}
