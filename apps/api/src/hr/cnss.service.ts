import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpertiseResolverService } from '../settings/expertise-resolver.service';
import {
  computeCnssAmounts,
  currentPeriodYm,
  normalizePeriodYm,
  type CnssCalcResult,
} from './cnss-calc';
import { HR_ERROR_CODES, HR_EVENT_TYPES } from './hr.constants';
import { HrException } from './hr.exception';

export type CnssPreviewDto = CnssCalcResult & {
  contractId: string;
  employeeId: string;
  periodYm: string;
  currency: 'TND';
  prefsHref: string;
};

export type CnssSnapshotDto = {
  id: string;
  companyId: string;
  periodYm: string;
  employeeId: string;
  contractId: string;
  wageBase: string;
  assiette: string;
  ceilingApplied: boolean;
  ceilingAmount: string | null;
  employeeRateBps: number | null;
  employerRateBps: number | null;
  employeeAmount: string | null;
  employerAmount: string | null;
  employeeLawRef: string | null;
  employerLawRef: string | null;
  ceilingLawRef: string | null;
  currency: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class CnssService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly expertise: ExpertiseResolverService,
  ) {}

  async preview(
    companyId: string,
    contractId: string,
    periodYmRaw?: string,
  ): Promise<CnssPreviewDto> {
    const contract = await this.requireContract(companyId, contractId);
    const periodYm =
      (periodYmRaw ? normalizePeriodYm(periodYmRaw) : null) ??
      currentPeriodYm();
    if (periodYmRaw && !normalizePeriodYm(periodYmRaw)) {
      throw new HrException(
        HR_ERROR_CODES.CNSS_INVALID_PERIOD,
        'periodYm must be YYYY-MM.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const calc = await this.calcForContract(companyId, contract);
    return {
      ...calc,
      contractId: contract.id,
      employeeId: contract.employeeId,
      periodYm,
      currency: 'TND',
      prefsHref: '/settings#expertise',
    };
  }

  async createSnapshot(
    companyId: string,
    input: { contractId: string; periodYm?: string },
  ): Promise<CnssSnapshotDto> {
    const contract = await this.requireContract(companyId, input.contractId);
    const periodYm =
      (input.periodYm ? normalizePeriodYm(input.periodYm) : null) ??
      currentPeriodYm();
    if (input.periodYm && !normalizePeriodYm(input.periodYm)) {
      throw new HrException(
        HR_ERROR_CODES.CNSS_INVALID_PERIOD,
        'periodYm must be YYYY-MM.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const calc = await this.calcForContract(companyId, contract);
    if (!calc.ready || calc.employeeAmount == null || calc.employerAmount == null) {
      throw new HrException(
        HR_ERROR_CODES.CNSS_RATES_PENDING,
        'CNSS snapshot requires VALIDATED employee + employer rates and wageBase > 0. Configure Préférences expertise.',
        HttpStatus.CONFLICT,
        { pending: calc.pending },
      );
    }

    const existing = await this.prisma.hrCnssSnapshot.findFirst({
      where: {
        companyId,
        periodYm,
        contractId: contract.id,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new HrException(
        HR_ERROR_CODES.CNSS_SNAPSHOT_EXISTS,
        'A CNSS snapshot already exists for this contract and period.',
        HttpStatus.CONFLICT,
        { snapshotId: existing.id },
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.hrCnssSnapshot.create({
        data: {
          companyId,
          periodYm,
          employeeId: contract.employeeId,
          contractId: contract.id,
          wageBase: new Prisma.Decimal(calc.wageBase),
          assiette: new Prisma.Decimal(calc.assiette),
          ceilingApplied: calc.ceilingApplied,
          ceilingAmount:
            calc.ceilingAmount != null
              ? new Prisma.Decimal(calc.ceilingAmount)
              : null,
          employeeRateBps: calc.employeeRateBps,
          employerRateBps: calc.employerRateBps,
          employeeAmount: new Prisma.Decimal(calc.employeeAmount!),
          employerAmount: new Prisma.Decimal(calc.employerAmount!),
          employeeLawRef: calc.employeeLawRef,
          employerLawRef: calc.employerLawRef,
          ceilingLawRef: calc.ceilingLawRef,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'hr_cnss_snapshot',
        aggregateId: created.id,
        eventType: HR_EVENT_TYPES.CNSS_SNAPSHOT_CREATED,
        payloadJson: {
          snapshotId: created.id,
          periodYm,
          contractId: contract.id,
          employeeId: contract.employeeId,
          employeeAmount: calc.employeeAmount,
          employerAmount: calc.employerAmount,
        },
      });
      return created;
    });

    return serializeSnapshot(row);
  }

  async listSnapshots(
    companyId: string,
    opts?: { periodYm?: string; employeeId?: string; limit?: number },
  ): Promise<{ items: CnssSnapshotDto[] }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const periodYm = opts?.periodYm
      ? normalizePeriodYm(opts.periodYm)
      : undefined;
    if (opts?.periodYm && !periodYm) {
      throw new HrException(
        HR_ERROR_CODES.CNSS_INVALID_PERIOD,
        'periodYm must be YYYY-MM.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const rows = await this.prisma.hrCnssSnapshot.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(periodYm ? { periodYm } : {}),
        ...(opts?.employeeId ? { employeeId: opts.employeeId } : {}),
      },
      orderBy: [{ periodYm: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return { items: rows.map(serializeSnapshot) };
  }

  private async calcForContract(
    companyId: string,
    contract: { wageBase: Prisma.Decimal | null },
  ): Promise<CnssCalcResult> {
    const wageBase = contract.wageBase
      ? Number(contract.wageBase.toFixed(3))
      : 0;
    const [employee, employer, ceiling] = await Promise.all([
      this.expertise.getValidated(companyId, 'hr.cnss.employee'),
      this.expertise.getValidated(companyId, 'hr.cnss.employer'),
      this.expertise.getValidated(companyId, 'hr.cnss.ceiling'),
    ]);
    return computeCnssAmounts({
      wageBase,
      employee:
        employee?.rateBps != null && employee.rateBps > 0
          ? { rateBps: employee.rateBps, lawRef: employee.lawRef }
          : null,
      employer:
        employer?.rateBps != null && employer.rateBps > 0
          ? { rateBps: employer.rateBps, lawRef: employer.lawRef }
          : null,
      ceiling:
        ceiling?.amountMilli != null && ceiling.amountMilli > 0
          ? {
              amountTnd: ceiling.amountMilli / 1000,
              lawRef: ceiling.lawRef,
            }
          : null,
    });
  }

  private async requireContract(companyId: string, contractId: string) {
    const row = await this.prisma.hrContract.findFirst({
      where: { id: contractId, companyId, deletedAt: null },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.CONTRACT_NOT_FOUND,
        'Contract not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

function serializeSnapshot(row: {
  id: string;
  companyId: string;
  periodYm: string;
  employeeId: string;
  contractId: string;
  wageBase: Prisma.Decimal;
  assiette: Prisma.Decimal;
  ceilingApplied: boolean;
  ceilingAmount: Prisma.Decimal | null;
  employeeRateBps: number | null;
  employerRateBps: number | null;
  employeeAmount: Prisma.Decimal | null;
  employerAmount: Prisma.Decimal | null;
  employeeLawRef: string | null;
  employerLawRef: string | null;
  ceilingLawRef: string | null;
  currency: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): CnssSnapshotDto {
  return {
    id: row.id,
    companyId: row.companyId,
    periodYm: row.periodYm,
    employeeId: row.employeeId,
    contractId: row.contractId,
    wageBase: row.wageBase.toFixed(3),
    assiette: row.assiette.toFixed(3),
    ceilingApplied: row.ceilingApplied,
    ceilingAmount: row.ceilingAmount?.toFixed(3) ?? null,
    employeeRateBps: row.employeeRateBps,
    employerRateBps: row.employerRateBps,
    employeeAmount: row.employeeAmount?.toFixed(3) ?? null,
    employerAmount: row.employerAmount?.toFixed(3) ?? null,
    employeeLawRef: row.employeeLawRef,
    employerLawRef: row.employerLawRef,
    ceilingLawRef: row.ceilingLawRef,
    currency: row.currency,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
