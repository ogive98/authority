import { Injectable } from '@nestjs/common';
import { TaxWithholdingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TejLocalService } from './tej-local.service';
import { RasEngineService } from './ras-engine.service';

export type TejCenterOverviewDto = {
  periodLabel: string;
  architecture: {
    module: 'tax';
    domain: 'RAS';
    surface: 'TEJ_CENTER';
    transmission: 'DISABLED';
    xmlMode: 'LOCAL_DRAFT_UNTIL_OFFICIAL_XSD';
  };
  withholdings: {
    total: number;
    byStatus: Record<string, number>;
    needingValidation: number;
    validated: number;
    certificateReady: number;
    tejPrepared: number;
    stubBlocked: number;
    amountWithheldValidated: string;
  };
  tejExports: {
    localDrafts: number;
    packs: number;
    transmission: 'DISABLED';
  };
};

/**
 * TEJ Center Soft Glass hub (D282) — counters only in Phase A.
 * No official XML schema · no transmission.
 */
@Injectable()
export class TejCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ras: RasEngineService,
    private readonly tejLocal: TejLocalService,
  ) {}

  async overview(
    companyId: string,
    periodLabel?: string,
  ): Promise<TejCenterOverviewDto> {
    const period =
      periodLabel?.trim() ||
      `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;

    const rows = await this.prisma.taxWithholding.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ periodLabel: period }, { periodLabel: null }],
      },
      select: {
        status: true,
        isStubRate: true,
        withholdingAmount: true,
        applicable: true,
      },
    });

    const byStatus: Record<string, number> = {};
    let needingValidation = 0;
    let validated = 0;
    let certificateReady = 0;
    let tejPrepared = 0;
    let stubBlocked = 0;
    let amountValidated = 0;

    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (
        r.status === TaxWithholdingStatus.CALCULATED ||
        r.status === TaxWithholdingStatus.DETECTED
      ) {
        needingValidation += 1;
      }
      if (
        r.status === TaxWithholdingStatus.VALIDATED ||
        r.status === TaxWithholdingStatus.CERTIFICATE_READY ||
        r.status === TaxWithholdingStatus.TEJ_PREPARED
      ) {
        amountValidated += Number(r.withholdingAmount);
      }
      if (r.status === TaxWithholdingStatus.VALIDATED) validated += 1;
      if (r.status === TaxWithholdingStatus.CERTIFICATE_READY)
        certificateReady += 1;
      if (r.status === TaxWithholdingStatus.TEJ_PREPARED) tejPrepared += 1;
      if (r.isStubRate && r.applicable === true) stubBlocked += 1;
    }

    const exports = await this.tejLocal.list(companyId, { limit: 50 });
    const packs = exports.items.filter(
      (i) => i.packKind === 'WITHHOLDING_PACK',
    ).length;

    return {
      periodLabel: period,
      architecture: {
        module: 'tax',
        domain: 'RAS',
        surface: 'TEJ_CENTER',
        transmission: 'DISABLED',
        xmlMode: 'LOCAL_DRAFT_UNTIL_OFFICIAL_XSD',
      },
      withholdings: {
        total: rows.length,
        byStatus,
        needingValidation,
        validated,
        certificateReady,
        tejPrepared,
        stubBlocked,
        amountWithheldValidated: amountValidated.toFixed(3),
      },
      tejExports: {
        localDrafts: exports.items.length,
        packs,
        transmission: 'DISABLED',
      },
    };
  }

  listWithholdings(
    companyId: string,
    opts?: { status?: TaxWithholdingStatus; periodLabel?: string },
  ) {
    return this.ras.list(companyId, opts);
  }
}
