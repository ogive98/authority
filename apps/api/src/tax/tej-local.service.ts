import { createHash } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { TaxWithholdingStatus } from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpertiseResolverService } from '../settings/expertise-resolver.service';
import { TAX_ERROR_CODES, TAX_EVENT_TYPES } from './tax.constants';
import { TaxException } from './tax.exception';

/** Explicit non-official marker — never claim TEJ compliance. */
export const TEJ_LOCAL_SCHEMA_NOTE =
  'AUTHORITY_LOCAL_DRAFT — not an official TEJ XSD; awaiting validated schema; transmission DISABLED';

export type TejPackKind = 'META_DRAFT' | 'WITHHOLDING_PACK';

export type TejExportDto = {
  id: string;
  companyId: string;
  periodLabel: string;
  contentSha256: string;
  prefsValueLabel: string;
  lawRef: string | null;
  schemaNote: string;
  transmission: 'DISABLED';
  packKind: TejPackKind;
  withholdingCount: number;
  xmlContent?: string;
  createdAt: string;
};

@Injectable()
export class TejLocalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expertise: ExpertiseResolverService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    opts?: { limit?: number },
  ): Promise<{ items: TejExportDto[]; transmission: 'DISABLED' }> {
    const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 50);
    const rows = await this.prisma.taxTejExport.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return {
      items: rows.map((r) => serializeTej(r, false)),
      transmission: 'DISABLED',
    };
  }

  async get(
    companyId: string,
    id: string,
  ): Promise<TejExportDto & { transmission: 'DISABLED' }> {
    const row = await this.prisma.taxTejExport.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new TaxException(
        TAX_ERROR_CODES.NOT_FOUND,
        'TEJ local export not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return { ...serializeTej(row, true), transmission: 'DISABLED' };
  }

  /**
   * Build local XML meta draft + SHA-256 history (D265).
   * Requires tax.tej Prefs VALIDATED. Never transmits.
   */
  async generate(
    companyId: string,
    input: { periodLabel: string; createdByUserId?: string | null },
  ): Promise<TejExportDto & { transmission: 'DISABLED' }> {
    const periodLabel = assertPeriod(input.periodLabel);
    const tej = await this.requireTejPrefs(companyId);
    const generatedAt = new Date().toISOString();
    const xmlContent = buildLocalTejXml({
      companyId,
      periodLabel,
      valueLabel: tej.valueLabel,
      lawRef: tej.lawRef,
      generatedAt,
      withholdings: [],
    });
    return this.persistExport(companyId, {
      periodLabel,
      xmlContent,
      valueLabel: tej.valueLabel,
      lawRef: tej.lawRef,
      packKind: 'META_DRAFT',
      withholdingCount: 0,
      createdByUserId: input.createdByUserId ?? null,
      withholdingIds: [],
      eventType: TAX_EVENT_TYPES.TEJ_LOCAL_GENERATED,
    });
  }

  /**
   * D285 — pack CERTIFICATE_READY withholdings for a period into local XML.
   * Marks rows TEJ_PREPARED. Never transmits. Not an official TEJ XSD.
   */
  async generatePack(
    companyId: string,
    input: { periodLabel: string; createdByUserId?: string | null },
  ): Promise<TejExportDto & { transmission: 'DISABLED' }> {
    const periodLabel = assertPeriod(input.periodLabel);
    const tej = await this.requireTejPrefs(companyId);

    const rows = await this.prisma.taxWithholding.findMany({
      where: {
        companyId,
        deletedAt: null,
        periodLabel,
        status: TaxWithholdingStatus.CERTIFICATE_READY,
        isStubRate: false,
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    if (rows.length === 0) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_STATUS,
        'Aucune retenue CERTIFICATE_READY pour cette période — valider + certificat d’abord (D284).',
        HttpStatus.CONFLICT,
      );
    }

    const company = await this.prisma.orgCompany.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { legalName: true },
    });
    const generatedAt = new Date().toISOString();
    const xmlContent = buildLocalTejXml({
      companyId,
      periodLabel,
      valueLabel: tej.valueLabel,
      lawRef: tej.lawRef,
      generatedAt,
      withholderName: company?.legalName?.trim() || null,
      withholdings: rows.map((r) => ({
        id: r.id,
        vendorName: r.vendorName,
        baseAmount: r.baseAmount.toString(),
        rateBps: r.rateBps,
        withholdingAmount: r.withholdingAmount.toString(),
        netPayable: r.netPayable?.toString() ?? null,
        currency: r.currency,
        lawRef: r.lawRef,
        certificateSha256: r.certificateSha256,
        apPaymentId: r.apPaymentId,
      })),
    });

    return this.persistExport(companyId, {
      periodLabel,
      xmlContent,
      valueLabel: tej.valueLabel,
      lawRef: tej.lawRef,
      packKind: 'WITHHOLDING_PACK',
      withholdingCount: rows.length,
      createdByUserId: input.createdByUserId ?? null,
      withholdingIds: rows.map((r) => r.id),
      eventType: TAX_EVENT_TYPES.TEJ_PACK_PREPARED,
    });
  }

  private async requireTejPrefs(companyId: string) {
    const tej = await this.expertise.getTej(companyId);
    if (!tej) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_STATUS,
        'TEJ Prefs must be VALIDATED before generating a local draft. No invented params.',
        HttpStatus.CONFLICT,
      );
    }
    return tej;
  }

  private async persistExport(
    companyId: string,
    input: {
      periodLabel: string;
      xmlContent: string;
      valueLabel: string;
      lawRef: string | null;
      packKind: TejPackKind;
      withholdingCount: number;
      createdByUserId: string | null;
      withholdingIds: string[];
      eventType: string;
    },
  ): Promise<TejExportDto & { transmission: 'DISABLED' }> {
    const contentSha256 = createHash('sha256')
      .update(input.xmlContent, 'utf8')
      .digest('hex');

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.taxTejExport.create({
        data: {
          companyId,
          periodLabel: input.periodLabel,
          contentSha256,
          xmlContent: input.xmlContent,
          prefsValueLabel: input.valueLabel,
          lawRef: input.lawRef,
          schemaNote: TEJ_LOCAL_SCHEMA_NOTE,
          transmission: 'DISABLED',
          packKind: input.packKind,
          withholdingCount: input.withholdingCount,
          createdByUserId: input.createdByUserId,
        },
      });

      if (input.withholdingIds.length > 0) {
        await tx.taxWithholding.updateMany({
          where: {
            companyId,
            id: { in: input.withholdingIds },
            status: TaxWithholdingStatus.CERTIFICATE_READY,
            deletedAt: null,
          },
          data: {
            status: TaxWithholdingStatus.TEJ_PREPARED,
            tejExportId: created.id,
            version: { increment: 1 },
          },
        });
      }

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'tax_tej_export',
        aggregateId: created.id,
        eventType: input.eventType,
        payloadJson: {
          tejExportId: created.id,
          periodLabel: input.periodLabel,
          contentSha256,
          transmission: 'DISABLED',
          schemaNote: TEJ_LOCAL_SCHEMA_NOTE,
          packKind: input.packKind,
          withholdingCount: input.withholdingCount,
          withholdingIds: input.withholdingIds,
        },
      });
      return created;
    });

    return { ...serializeTej(row, true), transmission: 'DISABLED' };
  }
}

function assertPeriod(raw: string): string {
  const periodLabel = raw.trim();
  if (!periodLabel || periodLabel.length > 64) {
    throw new TaxException(
      TAX_ERROR_CODES.INVALID_INPUT,
      'periodLabel is required (max 64).',
      HttpStatus.BAD_REQUEST,
    );
  }
  return periodLabel;
}

function buildLocalTejXml(input: {
  companyId: string;
  periodLabel: string;
  valueLabel: string;
  lawRef: string | null;
  generatedAt: string;
  withholderName?: string | null;
  withholdings: Array<{
    id: string;
    vendorName: string;
    baseAmount: string;
    rateBps: number | null;
    withholdingAmount: string;
    netPayable: string | null;
    currency: string;
    lawRef: string | null;
    certificateSha256: string | null;
    apPaymentId: string | null;
  }>;
}): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<AuthorityTejLocalDraft schema="${esc(TEJ_LOCAL_SCHEMA_NOTE)}" transmission="DISABLED" packKind="${input.withholdings.length > 0 ? 'WITHHOLDING_PACK' : 'META_DRAFT'}">`,
    `  <meta>`,
    `    <companyId>${esc(input.companyId)}</companyId>`,
    input.withholderName
      ? `    <withholderName>${esc(input.withholderName)}</withholderName>`
      : null,
    `    <periodLabel>${esc(input.periodLabel)}</periodLabel>`,
    `    <generatedAt>${esc(input.generatedAt)}</generatedAt>`,
    `    <prefsValueLabel>${esc(input.valueLabel)}</prefsValueLabel>`,
    `    <lawRef>${esc(input.lawRef ?? '')}</lawRef>`,
    `    <withholdingCount>${input.withholdings.length}</withholdingCount>`,
    `  </meta>`,
    `  <disclaimer>Local draft only. Not an official TEJ filing. Do not upload or transmit. Official XSD not provided.</disclaimer>`,
  ].filter((l) => l != null);

  if (input.withholdings.length > 0) {
    lines.push('  <withholdings>');
    for (const w of input.withholdings) {
      lines.push(
        `    <withholding id="${esc(w.id)}">`,
        `      <vendorName>${esc(w.vendorName)}</vendorName>`,
        `      <baseAmount>${esc(w.baseAmount)}</baseAmount>`,
        `      <rateBps>${w.rateBps ?? ''}</rateBps>`,
        `      <withholdingAmount>${esc(w.withholdingAmount)}</withholdingAmount>`,
        `      <netPayable>${esc(w.netPayable ?? '')}</netPayable>`,
        `      <currency>${esc(w.currency)}</currency>`,
        `      <lawRef>${esc(w.lawRef ?? '')}</lawRef>`,
        `      <certificateSha256>${esc(w.certificateSha256 ?? '')}</certificateSha256>`,
        w.apPaymentId
          ? `      <apPaymentId>${esc(w.apPaymentId)}</apPaymentId>`
          : null,
        `    </withholding>`,
      );
    }
    lines.push('  </withholdings>');
  }

  lines.push('</AuthorityTejLocalDraft>', '');
  return lines.filter((l) => l != null).join('\n');
}

function serializeTej(
  row: {
    id: string;
    companyId: string;
    periodLabel: string;
    contentSha256: string;
    xmlContent: string;
    prefsValueLabel: string;
    lawRef: string | null;
    schemaNote: string;
    packKind?: string | null;
    withholdingCount?: number | null;
    createdAt: Date;
  },
  includeXml: boolean,
): TejExportDto {
  const packKind =
    row.packKind === 'WITHHOLDING_PACK' ? 'WITHHOLDING_PACK' : 'META_DRAFT';
  return {
    id: row.id,
    companyId: row.companyId,
    periodLabel: row.periodLabel,
    contentSha256: row.contentSha256,
    prefsValueLabel: row.prefsValueLabel,
    lawRef: row.lawRef,
    schemaNote: row.schemaNote,
    transmission: 'DISABLED',
    packKind,
    withholdingCount: row.withholdingCount ?? 0,
    ...(includeXml ? { xmlContent: row.xmlContent } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}
