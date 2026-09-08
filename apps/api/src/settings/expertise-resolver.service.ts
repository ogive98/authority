import { Injectable } from '@nestjs/common';
import {
  EXPERTISE_CATALOG,
  isExpertiseWritableKey,
  type ExpertiseSlotKey,
  type ExpertiseSlotStatus,
} from './settings.constants';
import { SettingsService, type ExpertiseSlotDto } from './settings.service';

/**
 * Consumer API for Tax / Finance / Payroll (D092).
 * Returns null when PENDING — never invents rates.
 */
@Injectable()
export class ExpertiseResolverService {
  constructor(private readonly settings: SettingsService) {}

  async list(companyId: string) {
    return this.settings.listExpertise(companyId);
  }

  async getSlot(
    companyId: string,
    slotKey: string,
  ): Promise<ExpertiseSlotDto | null> {
    const catalog = await this.settings.listExpertise(companyId);
    return catalog.items.find((i) => i.key === slotKey) ?? null;
  }

  /**
   * Only VALIDATED slots with a non-empty value — safe for calculation consumers.
   */
  async getValidated(
    companyId: string,
    slotKey: ExpertiseSlotKey | string,
  ): Promise<ValidatedExpertise | null> {
    const slot = await this.getSlot(companyId, slotKey);
    if (!slot || slot.status !== 'VALIDATED') return null;
    if (!slot.valueSummary?.trim()) return null;
    return {
      key: slot.key,
      domain: slot.domain,
      label: slot.label,
      valueLabel: slot.valueSummary,
      lawRef: slot.lawRef,
      rateBps: slot.rateBps,
      amountMilli: slot.amountMilli,
      expertValidatedAt: slot.expertValidatedAt,
    };
  }

  /** Convenience: FODEC for invoicing — null if expert not yet entered. */
  async getFodec(companyId: string): Promise<ValidatedExpertise | null> {
    return this.getValidated(companyId, 'tax.fodec');
  }

  /** Convenience: timbre — null if expert not yet entered. */
  async getTimbre(companyId: string): Promise<ValidatedExpertise | null> {
    return this.getValidated(companyId, 'tax.timbre');
  }

  /** HR contribution slots — all PENDING until expert. */
  async getHrContributionSnapshot(companyId: string): Promise<{
    cnss: ValidatedExpertise | null;
    irpp: ValidatedExpertise | null;
    tfp: ValidatedExpertise | null;
    pendingKeys: string[];
  }> {
    const [cnss, irpp, tfp] = await Promise.all([
      this.getValidated(companyId, 'hr.cnss'),
      this.getValidated(companyId, 'hr.irpp'),
      this.getValidated(companyId, 'hr.tfp'),
    ]);
    const pendingKeys = EXPERTISE_CATALOG.filter(
      (s) =>
        isExpertiseWritableKey(s.key) &&
        s.domain === 'hr' &&
        !(
          (s.key === 'hr.cnss' && cnss) ||
          (s.key === 'hr.irpp' && irpp) ||
          (s.key === 'hr.tfp' && tfp)
        ),
    ).map((s) => s.key);

    return { cnss, irpp, tfp, pendingKeys };
  }
}

export type ValidatedExpertise = {
  key: string;
  domain: string;
  label: string;
  valueLabel: string;
  lawRef: string | null;
  rateBps: number | null;
  amountMilli: number | null;
  expertValidatedAt: string | null;
};

export type { ExpertiseSlotStatus };
