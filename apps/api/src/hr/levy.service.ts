import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExpertiseResolverService } from '../settings/expertise-resolver.service';
import { HR_ERROR_CODES } from './hr.constants';
import { HrException } from './hr.exception';
import {
  computeHrLevies,
  type HrLeviesCalcResult,
  type LevyRateInput,
} from './levy-calc';

export type LevyPreviewDto = HrLeviesCalcResult & {
  contractId: string;
  employeeId: string;
  currency: 'TND';
  prefsHref: string;
  note: string;
};

@Injectable()
export class LevyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expertise: ExpertiseResolverService,
  ) {}

  async preview(
    companyId: string,
    contractId: string,
  ): Promise<LevyPreviewDto> {
    const contract = await this.requireContract(companyId, contractId);
    const calc = await this.calcForContract(companyId, contract);
    return {
      ...calc,
      contractId: contract.id,
      employeeId: contract.employeeId,
      currency: 'TND',
      prefsHref: '/settings#expertise',
      note: 'Employer levies only — not deducted from bulletin net. VALIDATED Prefs rateBps only.',
    };
  }

  private async calcForContract(
    companyId: string,
    contract: { wageBase: Prisma.Decimal | null },
  ): Promise<HrLeviesCalcResult> {
    const wageBase = contract.wageBase
      ? Number(contract.wageBase.toFixed(3))
      : 0;
    const snap = await this.expertise.getHrContributionSnapshot(companyId);
    return computeHrLevies({
      wageBase,
      tfp: toLevyRate(snap.tfp),
      foprolos: toLevyRate(snap.foprolos),
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

function toLevyRate(
  slot: { rateBps: number | null; lawRef: string | null } | null,
): LevyRateInput {
  if (
    slot?.rateBps == null ||
    !Number.isFinite(slot.rateBps) ||
    slot.rateBps < 0
  ) {
    return null;
  }
  return { rateBps: slot.rateBps, lawRef: slot.lawRef };
}
