import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  TaxWithholdingStatus,
} from '@prisma/client';
import { isStubUntilExpert } from '../settings/settings.constants';
import { ExpertiseResolverService } from '../settings/expertise-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { TAX_ERROR_CODES, TAX_EVENT_TYPES } from './tax.constants';
import { TaxException } from './tax.exception';
import { OutboxService } from '../audit/outbox.service';

export const RAS_DECISION_CODES = {
  PREFS_PENDING: 'RAS.PREFS_PENDING',
  PREFS_STUB: 'RAS.PREFS_STUB',
  RATE_MISSING: 'RAS.RATE_MISSING',
  BASE_INVALID: 'RAS.BASE_INVALID',
  APPLICABLE: 'RAS.APPLICABLE',
  NOT_APPLICABLE_ZERO: 'RAS.NOT_APPLICABLE_ZERO',
} as const;

export type RasDetectInput = {
  baseAmount: number;
  vendorName: string;
  supplierId?: string;
  apBillId?: string;
  apPaymentId?: string;
  periodLabel?: string;
  currency?: string;
};

export type RasDetectResult = {
  applicable: boolean | null;
  decisionCode: string;
  decisionReason: string;
  baseAmount: string;
  rateBps: number | null;
  withholdingAmount: string;
  netPayable: string | null;
  lawRef: string | null;
  isStubRate: boolean;
  prefsSnapshot: Record<string, unknown>;
};

export type TaxWithholdingDto = {
  id: string;
  companyId: string;
  status: TaxWithholdingStatus;
  applicable: boolean | null;
  decisionCode: string;
  decisionReason: string;
  supplierId: string | null;
  apBillId: string | null;
  apPaymentId: string | null;
  vendorName: string;
  baseAmount: string;
  rateBps: number | null;
  withholdingAmount: string;
  netPayable: string | null;
  currency: string;
  lawRef: string | null;
  periodLabel: string | null;
  isStubRate: boolean;
  prefsSnapshot: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function dec(n: number): string {
  return round3(n).toFixed(3);
}

/**
 * RAS Engine Phase A (D282) — detect + calculate from Prefs tax.ras.
 * Never invents rates. TEJ XML / transmission out of scope here.
 */
@Injectable()
export class RasEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expertise: ExpertiseResolverService,
    private readonly outbox: OutboxService,
  ) {}

  async detect(
    companyId: string,
    input: RasDetectInput,
  ): Promise<RasDetectResult> {
    const vendorName = input.vendorName?.trim() || 'Vendor';
    const base = Number(input.baseAmount);
    if (!Number.isFinite(base) || base <= 0) {
      return {
        applicable: false,
        decisionCode: RAS_DECISION_CODES.BASE_INVALID,
        decisionReason:
          'Base invalide — montant ≤ 0. Aucune retenue calculée.',
        baseAmount: dec(Number.isFinite(base) ? base : 0),
        rateBps: null,
        withholdingAmount: '0.000',
        netPayable: null,
        lawRef: null,
        isStubRate: false,
        prefsSnapshot: { vendorName },
      };
    }

    const slot = await this.expertise.getSlot(companyId, 'tax.ras');
    const stub = isStubUntilExpert(slot?.lawRef, slot?.notes);
    const prefsSnapshot: Record<string, unknown> = {
      vendorName,
      slotStatus: slot?.status ?? 'MISSING',
      valueSummary: slot?.valueSummary ?? null,
      lawRef: slot?.lawRef ?? null,
      rateBps: slot?.rateBps ?? null,
      isStub: stub,
    };

    if (!slot || slot.status !== 'VALIDATED') {
      return {
        applicable: null,
        decisionCode: RAS_DECISION_CODES.PREFS_PENDING,
        decisionReason:
          'Prefs tax.ras non VALIDATED — retenue non déterminée (jamais inventée). Saisir le taux en Préférences → Expertise.',
        baseAmount: dec(base),
        rateBps: null,
        withholdingAmount: '0.000',
        netPayable: null,
        lawRef: slot?.lawRef ?? null,
        isStubRate: false,
        prefsSnapshot,
      };
    }

    if (slot.rateBps == null) {
      return {
        applicable: null,
        decisionCode: RAS_DECISION_CODES.RATE_MISSING,
        decisionReason:
          'Prefs tax.ras VALIDATED mais rateBps absent — compléter le taux (bps) avant calcul.',
        baseAmount: dec(base),
        rateBps: null,
        withholdingAmount: '0.000',
        netPayable: null,
        lawRef: slot.lawRef,
        isStubRate: stub,
        prefsSnapshot,
      };
    }

    const preview = await this.expertise.previewRas(companyId, base);
    if (!preview.applied) {
      return {
        applicable: false,
        decisionCode: RAS_DECISION_CODES.NOT_APPLICABLE_ZERO,
        decisionReason:
          'Prévisualisation RAS non appliquée (base ou taux).',
        baseAmount: dec(base),
        rateBps: preview.rateBps,
        withholdingAmount: '0.000',
        netPayable: dec(base),
        lawRef: slot.lawRef,
        isStubRate: stub,
        prefsSnapshot,
      };
    }

    const wh = round3(preview.amount);
    const net = round3(base - wh);
    const stubNote = stub
      ? ' ATTENTION : taux encore marqué STUB_UNTIL_EXPERT — à remplacer par le comptable (D280).'
      : '';

    return {
      applicable: true,
      decisionCode: stub
        ? RAS_DECISION_CODES.PREFS_STUB
        : RAS_DECISION_CODES.APPLICABLE,
      decisionReason: stub
        ? `Retenue applicable (stub démo)${stubNote} Base ${dec(base)} · ${slot.rateBps} bps · RAS ${dec(wh)} · net ${dec(net)}.`
        : `Retenue applicable selon Prefs tax.ras VALIDATED. Base ${dec(base)} · ${slot.rateBps} bps · RAS ${dec(wh)} · net ${dec(net)}.`,
      baseAmount: dec(base),
      rateBps: slot.rateBps,
      withholdingAmount: dec(wh),
      netPayable: dec(net),
      lawRef: slot.lawRef,
      isStubRate: stub,
      prefsSnapshot,
    };
  }

  async createFromDetect(
    companyId: string,
    input: RasDetectInput,
  ): Promise<TaxWithholdingDto> {
    const detected = await this.detect(companyId, input);
    const vendorName = input.vendorName?.trim() || 'Vendor';
    const status: TaxWithholdingStatus =
      detected.applicable === true && detected.rateBps != null
        ? TaxWithholdingStatus.CALCULATED
        : TaxWithholdingStatus.DETECTED;

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.taxWithholding.create({
        data: {
          companyId,
          status,
          applicable: detected.applicable,
          decisionReason: detected.decisionReason,
          decisionCode: detected.decisionCode,
          supplierId: input.supplierId ?? null,
          apBillId: input.apBillId ?? null,
          apPaymentId: input.apPaymentId ?? null,
          vendorName,
          baseAmount: new Prisma.Decimal(detected.baseAmount),
          rateBps: detected.rateBps,
          withholdingAmount: new Prisma.Decimal(detected.withholdingAmount),
          netPayable:
            detected.netPayable != null
              ? new Prisma.Decimal(detected.netPayable)
              : null,
          currency: input.currency?.trim() || 'TND',
          lawRef: detected.lawRef,
          periodLabel: input.periodLabel?.trim() || null,
          prefsSnapshotJson: detected.prefsSnapshot as Prisma.InputJsonValue,
          isStubRate: detected.isStubRate,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'tax_withholding',
        aggregateId: created.id,
        eventType: TAX_EVENT_TYPES.WITHHOLDING_CREATED,
        payloadJson: {
          withholdingId: created.id,
          status: created.status,
          decisionCode: created.decisionCode,
          applicable: created.applicable,
        },
      });
      return created;
    });

    return serializeWithholding(row);
  }

  async list(
    companyId: string,
    opts?: { status?: TaxWithholdingStatus; periodLabel?: string },
  ): Promise<{ items: TaxWithholdingDto[] }> {
    const rows = await this.prisma.taxWithholding.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(opts?.status ? { status: opts.status } : {}),
        ...(opts?.periodLabel ? { periodLabel: opts.periodLabel } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items: rows.map(serializeWithholding) };
  }

  async get(companyId: string, id: string): Promise<TaxWithholdingDto> {
    const row = await this.findScoped(companyId, id);
    return serializeWithholding(row);
  }

  async validate(
    companyId: string,
    id: string,
  ): Promise<TaxWithholdingDto> {
    const row = await this.findScoped(companyId, id);
    if (
      row.status !== TaxWithholdingStatus.CALCULATED &&
      row.status !== TaxWithholdingStatus.DETECTED
    ) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_STATUS,
        `Cannot validate from status ${row.status}.`,
        HttpStatus.CONFLICT,
      );
    }
    if (row.applicable !== true || row.rateBps == null) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_STATUS,
        'Cannot validate a non-applicable or uncalculated withholding. Fix Prefs tax.ras first.',
        HttpStatus.CONFLICT,
      );
    }
    if (row.isStubRate) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_STATUS,
        'Cannot validate while rate is STUB_UNTIL_EXPERT — replace Prefs tax.ras first (D280).',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.taxWithholding.update({
        where: { id: row.id },
        data: {
          status: TaxWithholdingStatus.VALIDATED,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'tax_withholding',
        aggregateId: next.id,
        eventType: TAX_EVENT_TYPES.WITHHOLDING_VALIDATED,
        payloadJson: {
          withholdingId: next.id,
          from: row.status,
          to: next.status,
        },
      });
      return next;
    });
    return serializeWithholding(updated);
  }

  private async findScoped(companyId: string, id: string) {
    const row = await this.prisma.taxWithholding.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new TaxException(
        TAX_ERROR_CODES.NOT_FOUND,
        'Withholding not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

function serializeWithholding(row: {
  id: string;
  companyId: string;
  status: TaxWithholdingStatus;
  applicable: boolean | null;
  decisionCode: string;
  decisionReason: string;
  supplierId: string | null;
  apBillId: string | null;
  apPaymentId: string | null;
  vendorName: string;
  baseAmount: Prisma.Decimal;
  rateBps: number | null;
  withholdingAmount: Prisma.Decimal;
  netPayable: Prisma.Decimal | null;
  currency: string;
  lawRef: string | null;
  periodLabel: string | null;
  prefsSnapshotJson: unknown;
  isStubRate: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): TaxWithholdingDto {
  return {
    id: row.id,
    companyId: row.companyId,
    status: row.status,
    applicable: row.applicable,
    decisionCode: row.decisionCode,
    decisionReason: row.decisionReason,
    supplierId: row.supplierId,
    apBillId: row.apBillId,
    apPaymentId: row.apPaymentId,
    vendorName: row.vendorName,
    baseAmount: row.baseAmount.toString(),
    rateBps: row.rateBps,
    withholdingAmount: row.withholdingAmount.toString(),
    netPayable: row.netPayable?.toString() ?? null,
    currency: row.currency,
    lawRef: row.lawRef,
    periodLabel: row.periodLabel,
    isStubRate: row.isStubRate,
    prefsSnapshot: (row.prefsSnapshotJson ?? {}) as Record<string, unknown>,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
