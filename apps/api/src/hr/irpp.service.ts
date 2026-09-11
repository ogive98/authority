import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpertiseResolverService } from '../settings/expertise-resolver.service';
import { computeCnssAmounts } from './cnss-calc';
import { currentPeriodYm, normalizePeriodYm } from './cnss-calc';
import {
  computeIrppAmounts,
  validateIrppBrackets,
  type IrppBracketInput,
  type IrppCalcResult,
} from './irpp-calc';
import { HR_ERROR_CODES, HR_EVENT_TYPES } from './hr.constants';
import { HrException } from './hr.exception';

export type IrppBracketDto = {
  id: string;
  sortOrder: number;
  upToMilli: number | null;
  rateBps: number;
  lawRef: string | null;
};

export type IrppPreviewDto = IrppCalcResult & {
  contractId: string;
  employeeId: string;
  periodYm: string;
  currency: 'TND';
  prefsHref: string;
};

export type IrppSnapshotDto = {
  id: string;
  companyId: string;
  periodYm: string;
  employeeId: string;
  contractId: string;
  wageBase: string;
  cnssEmployeeAmount: string;
  taxableMonthly: string;
  annualTaxable: string;
  annualIrpp: string;
  monthlyIrpp: string;
  bracketsJson: IrppBracketInput[];
  irppLawRef: string | null;
  methodNote: string;
  currency: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class IrppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly expertise: ExpertiseResolverService,
  ) {}

  async listBrackets(companyId: string): Promise<{ items: IrppBracketDto[] }> {
    const rows = await this.prisma.hrIrppBracket.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        sortOrder: r.sortOrder,
        upToMilli: r.upToMilli,
        rateBps: r.rateBps,
        lawRef: r.lawRef,
      })),
    };
  }

  /**
   * Replace company annual IRPP brackets (human only — never seed).
   */
  async replaceBrackets(
    companyId: string,
    brackets: Array<{
      upToMilli: number | null;
      rateBps: number;
      lawRef?: string | null;
    }>,
  ): Promise<{ items: IrppBracketDto[] }> {
    const err = validateIrppBrackets(brackets);
    if (err) {
      throw new HrException(
        HR_ERROR_CODES.IRPP_INVALID_BRACKETS,
        err,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.hrIrppBracket.updateMany({
        where: { companyId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      for (let i = 0; i < brackets.length; i++) {
        const b = brackets[i]!;
        await tx.hrIrppBracket.create({
          data: {
            companyId,
            sortOrder: i,
            upToMilli: b.upToMilli,
            rateBps: b.rateBps,
            lawRef: b.lawRef?.trim() || null,
          },
        });
      }
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'hr_irpp_bracket',
        aggregateId: companyId,
        eventType: HR_EVENT_TYPES.IRPP_BRACKETS_REPLACED,
        payloadJson: { count: brackets.length },
      });
    });

    return this.listBrackets(companyId);
  }

  async preview(
    companyId: string,
    contractId: string,
    periodYmRaw?: string,
  ): Promise<IrppPreviewDto> {
    const contract = await this.requireContract(companyId, contractId);
    const periodYm =
      (periodYmRaw ? normalizePeriodYm(periodYmRaw) : null) ??
      currentPeriodYm();
    if (periodYmRaw && !normalizePeriodYm(periodYmRaw)) {
      throw new HrException(
        HR_ERROR_CODES.IRPP_INVALID_PERIOD,
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
  ): Promise<IrppSnapshotDto> {
    const contract = await this.requireContract(companyId, input.contractId);
    const periodYm =
      (input.periodYm ? normalizePeriodYm(input.periodYm) : null) ??
      currentPeriodYm();
    if (input.periodYm && !normalizePeriodYm(input.periodYm)) {
      throw new HrException(
        HR_ERROR_CODES.IRPP_INVALID_PERIOD,
        'periodYm must be YYYY-MM.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const calc = await this.calcForContract(companyId, contract);
    if (
      !calc.ready ||
      calc.monthlyIrpp == null ||
      calc.cnssEmployeeAmount == null ||
      calc.taxableMonthly == null ||
      calc.annualTaxable == null ||
      calc.annualIrpp == null
    ) {
      throw new HrException(
        HR_ERROR_CODES.IRPP_RATES_PENDING,
        'IRPP snapshot requires VALIDATED hr.irpp, annual brackets, wageBase, and CNSS salarié. Configure Préférences.',
        HttpStatus.CONFLICT,
        { pending: calc.pending },
      );
    }

    const existing = await this.prisma.hrIrppSnapshot.findFirst({
      where: {
        companyId,
        periodYm,
        contractId: contract.id,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new HrException(
        HR_ERROR_CODES.IRPP_SNAPSHOT_EXISTS,
        'An IRPP snapshot already exists for this contract and period.',
        HttpStatus.CONFLICT,
        { snapshotId: existing.id },
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.hrIrppSnapshot.create({
        data: {
          companyId,
          periodYm,
          employeeId: contract.employeeId,
          contractId: contract.id,
          wageBase: new Prisma.Decimal(calc.wageBase),
          cnssEmployeeAmount: new Prisma.Decimal(calc.cnssEmployeeAmount!),
          taxableMonthly: new Prisma.Decimal(calc.taxableMonthly!),
          annualTaxable: new Prisma.Decimal(calc.annualTaxable!),
          annualIrpp: new Prisma.Decimal(calc.annualIrpp!),
          monthlyIrpp: new Prisma.Decimal(calc.monthlyIrpp!),
          bracketsJson: calc.brackets as unknown as Prisma.InputJsonValue,
          irppLawRef: calc.irppLawRef,
          methodNote: calc.methodNote,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'hr_irpp_snapshot',
        aggregateId: created.id,
        eventType: HR_EVENT_TYPES.IRPP_SNAPSHOT_CREATED,
        payloadJson: {
          snapshotId: created.id,
          periodYm,
          contractId: contract.id,
          employeeId: contract.employeeId,
          monthlyIrpp: calc.monthlyIrpp,
        },
      });
      return created;
    });

    return serializeSnapshot(row);
  }

  async listSnapshots(
    companyId: string,
    opts?: { periodYm?: string; employeeId?: string; limit?: number },
  ): Promise<{ items: IrppSnapshotDto[] }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const periodYm = opts?.periodYm
      ? normalizePeriodYm(opts.periodYm)
      : undefined;
    if (opts?.periodYm && !periodYm) {
      throw new HrException(
        HR_ERROR_CODES.IRPP_INVALID_PERIOD,
        'periodYm must be YYYY-MM.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const rows = await this.prisma.hrIrppSnapshot.findMany({
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
  ): Promise<IrppCalcResult> {
    const wageBase = contract.wageBase
      ? Number(contract.wageBase.toFixed(3))
      : 0;

    const [employee, employer, ceiling, irppSlot, bracketRows] =
      await Promise.all([
        this.expertise.getValidated(companyId, 'hr.cnss.employee'),
        this.expertise.getValidated(companyId, 'hr.cnss.employer'),
        this.expertise.getValidated(companyId, 'hr.cnss.ceiling'),
        this.expertise.getValidated(companyId, 'hr.irpp'),
        this.prisma.hrIrppBracket.findMany({
          where: { companyId, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        }),
      ]);

    const cnss = computeCnssAmounts({
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

    const brackets: IrppBracketInput[] = bracketRows.map((b) => ({
      upToMilli: b.upToMilli,
      rateBps: b.rateBps,
      lawRef: b.lawRef,
    }));

    return computeIrppAmounts({
      wageBase,
      cnssEmployeeAmount: cnss.employeeAmount,
      cnssReady: cnss.employeeAmount != null,
      irppSlotValidated: irppSlot != null,
      brackets,
      irppLawRef: irppSlot?.lawRef ?? null,
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
  cnssEmployeeAmount: Prisma.Decimal;
  taxableMonthly: Prisma.Decimal;
  annualTaxable: Prisma.Decimal;
  annualIrpp: Prisma.Decimal;
  monthlyIrpp: Prisma.Decimal;
  bracketsJson: Prisma.JsonValue;
  irppLawRef: string | null;
  methodNote: string;
  currency: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): IrppSnapshotDto {
  return {
    id: row.id,
    companyId: row.companyId,
    periodYm: row.periodYm,
    employeeId: row.employeeId,
    contractId: row.contractId,
    wageBase: row.wageBase.toFixed(3),
    cnssEmployeeAmount: row.cnssEmployeeAmount.toFixed(3),
    taxableMonthly: row.taxableMonthly.toFixed(3),
    annualTaxable: row.annualTaxable.toFixed(3),
    annualIrpp: row.annualIrpp.toFixed(3),
    monthlyIrpp: row.monthlyIrpp.toFixed(3),
    bracketsJson: row.bracketsJson as IrppBracketInput[],
    irppLawRef: row.irppLawRef,
    methodNote: row.methodNote,
    currency: row.currency,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
