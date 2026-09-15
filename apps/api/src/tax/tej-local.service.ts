import { createHash } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpertiseResolverService } from '../settings/expertise-resolver.service';
import { TAX_ERROR_CODES, TAX_EVENT_TYPES } from './tax.constants';
import { TaxException } from './tax.exception';

/** Explicit non-official marker — never claim TEJ compliance. */
export const TEJ_LOCAL_SCHEMA_NOTE =
  'AUTHORITY_LOCAL_DRAFT — not an official TEJ XSD; awaiting validated schema; transmission DISABLED';

export type TejExportDto = {
  id: string;
  companyId: string;
  periodLabel: string;
  contentSha256: string;
  prefsValueLabel: string;
  lawRef: string | null;
  schemaNote: string;
  transmission: 'DISABLED';
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
   * Build local XML draft + SHA-256 history.
   * Requires tax.tej Prefs VALIDATED. Never transmits.
   */
  async generate(
    companyId: string,
    input: { periodLabel: string; createdByUserId?: string | null },
  ): Promise<TejExportDto & { transmission: 'DISABLED' }> {
    const periodLabel = input.periodLabel.trim();
    if (!periodLabel || periodLabel.length > 64) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_INPUT,
        'periodLabel is required (max 64).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const tej = await this.expertise.getTej(companyId);
    if (!tej) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_STATUS,
        'TEJ Prefs must be VALIDATED before generating a local draft. No invented params.',
        HttpStatus.CONFLICT,
      );
    }

    const generatedAt = new Date().toISOString();
    const xmlContent = buildLocalTejXml({
      companyId,
      periodLabel,
      valueLabel: tej.valueLabel,
      lawRef: tej.lawRef,
      generatedAt,
    });
    const contentSha256 = createHash('sha256')
      .update(xmlContent, 'utf8')
      .digest('hex');

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.taxTejExport.create({
        data: {
          companyId,
          periodLabel,
          contentSha256,
          xmlContent,
          prefsValueLabel: tej.valueLabel,
          lawRef: tej.lawRef,
          schemaNote: TEJ_LOCAL_SCHEMA_NOTE,
          transmission: 'DISABLED',
          createdByUserId: input.createdByUserId ?? null,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'tax_tej_export',
        aggregateId: created.id,
        eventType: TAX_EVENT_TYPES.TEJ_LOCAL_GENERATED,
        payloadJson: {
          tejExportId: created.id,
          periodLabel,
          contentSha256,
          transmission: 'DISABLED',
          schemaNote: TEJ_LOCAL_SCHEMA_NOTE,
        },
      });
      return created;
    });

    return { ...serializeTej(row, true), transmission: 'DISABLED' };
  }
}

function buildLocalTejXml(input: {
  companyId: string;
  periodLabel: string;
  valueLabel: string;
  lawRef: string | null;
  generatedAt: string;
}): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<AuthorityTejLocalDraft schema="${esc(TEJ_LOCAL_SCHEMA_NOTE)}" transmission="DISABLED">`,
    `  <meta>`,
    `    <companyId>${esc(input.companyId)}</companyId>`,
    `    <periodLabel>${esc(input.periodLabel)}</periodLabel>`,
    `    <generatedAt>${esc(input.generatedAt)}</generatedAt>`,
    `    <prefsValueLabel>${esc(input.valueLabel)}</prefsValueLabel>`,
    `    <lawRef>${esc(input.lawRef ?? '')}</lawRef>`,
    `  </meta>`,
    `  <disclaimer>Local draft only. Not an official TEJ filing. Do not upload or transmit.</disclaimer>`,
    `</AuthorityTejLocalDraft>`,
    '',
  ].join('\n');
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
    createdAt: Date;
  },
  includeXml: boolean,
): TejExportDto {
  return {
    id: row.id,
    companyId: row.companyId,
    periodLabel: row.periodLabel,
    contentSha256: row.contentSha256,
    prefsValueLabel: row.prefsValueLabel,
    lawRef: row.lawRef,
    schemaNote: row.schemaNote,
    transmission: 'DISABLED',
    ...(includeXml ? { xmlContent: row.xmlContent } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}
