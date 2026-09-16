import { createHash } from 'crypto';
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

/** Explicit non-official marker — never claim MF / TEJ compliance. */
export const RAS_CERT_SCHEMA_NOTE =
  'AUTHORITY_LOCAL_CERTIFICATE — attestation interne AUTHORITY; pas un formulaire officiel MF; pas de transmission TEJ';

export const RAS_DECISION_CODES = {
  PREFS_PENDING: 'RAS.PREFS_PENDING',
  PREFS_STUB: 'RAS.PREFS_STUB',
  RATE_MISSING: 'RAS.RATE_MISSING',
  BASE_INVALID: 'RAS.BASE_INVALID',
  APPLICABLE: 'RAS.APPLICABLE',
  NOT_APPLICABLE_ZERO: 'RAS.NOT_APPLICABLE_ZERO',
  /** D283 — amounts taken from posted AP payment (already disbursed net). */
  FROM_AP_PAYMENT: 'RAS.FROM_AP_PAYMENT',
  /** D286 — amounts from ISSUED AR invoice (client RAS flag). */
  FROM_AR_INVOICE: 'RAS.FROM_AR_INVOICE',
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
  side: 'AP' | 'AR';
  supplierId: string | null;
  apBillId: string | null;
  apPaymentId: string | null;
  arInvoiceId: string | null;
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
  certificateSha256: string | null;
  certificateAt: string | null;
  tejExportId: string | null;
  tejImportAckAt: string | null;
  tejImportNote: string | null;
  tejRejectReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type RasCertificateDto = {
  withholdingId: string;
  status: TaxWithholdingStatus;
  schemaNote: string;
  contentSha256: string;
  generatedAt: string;
  body: string;
  withholding: TaxWithholdingDto;
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
          side: 'AP',
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

  /**
   * D283 — materialize a CALCULATED withholding from a posted AP payment with RAS.
   * Idempotent on apPaymentId. Does not invent rates (amounts already applied on payment).
   */
  async createFromApPayment(
    companyId: string,
    input: {
      apPaymentId: string;
      apBillId?: string | null;
      supplierId?: string | null;
      vendorName: string;
      baseAmount: number;
      withholdingAmount: number;
      rateBps: number | null;
      netPayable: number;
      currency: string;
      paymentDate: Date;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<TaxWithholdingDto> {
    const run = async (client: Prisma.TransactionClient) => {
      const existing = await client.taxWithholding.findFirst({
        where: {
          companyId,
          apPaymentId: input.apPaymentId,
          deletedAt: null,
        },
      });
      if (existing) return serializeWithholding(existing);

      const slot = await this.expertise.getSlot(companyId, 'tax.ras');
      const stub = isStubUntilExpert(slot?.lawRef, slot?.notes);
      const periodLabel = `${input.paymentDate.getUTCFullYear()}-${String(input.paymentDate.getUTCMonth() + 1).padStart(2, '0')}`;
      const prefsSnapshot: Record<string, unknown> = {
        source: 'ap_payment',
        apPaymentId: input.apPaymentId,
        slotStatus: slot?.status ?? 'MISSING',
        lawRef: slot?.lawRef ?? null,
        rateBps: input.rateBps,
        isStub: stub,
      };
      const decisionCode = stub
        ? RAS_DECISION_CODES.PREFS_STUB
        : RAS_DECISION_CODES.FROM_AP_PAYMENT;
      const decisionReason = stub
        ? `Retenue issue du décaissement AP (stub démo STUB_UNTIL_EXPERT) — validation bloquée jusqu’au remplacement Prefs. Base ${dec(input.baseAmount)} · RAS ${dec(input.withholdingAmount)} · net ${dec(input.netPayable)}.`
        : `Retenue issue du décaissement AP POSTED. Base ${dec(input.baseAmount)} · ${input.rateBps ?? '—'} bps · RAS ${dec(input.withholdingAmount)} · net ${dec(input.netPayable)}.`;

      const created = await client.taxWithholding.create({
        data: {
          companyId,
          status: TaxWithholdingStatus.CALCULATED,
          applicable: true,
          decisionReason,
          decisionCode,
          supplierId: input.supplierId ?? null,
          apBillId: input.apBillId ?? null,
          apPaymentId: input.apPaymentId,
          side: 'AP',
          vendorName: input.vendorName.trim() || 'Vendor',
          baseAmount: new Prisma.Decimal(dec(input.baseAmount)),
          rateBps: input.rateBps,
          withholdingAmount: new Prisma.Decimal(dec(input.withholdingAmount)),
          netPayable: new Prisma.Decimal(dec(input.netPayable)),
          currency: input.currency?.trim() || 'TND',
          lawRef: slot?.lawRef ?? null,
          periodLabel,
          prefsSnapshotJson: prefsSnapshot as Prisma.InputJsonValue,
          isStubRate: stub,
        },
      });
      await this.outbox.enqueue(client, {
        companyId,
        aggregateType: 'tax_withholding',
        aggregateId: created.id,
        eventType: TAX_EVENT_TYPES.WITHHOLDING_FROM_AP,
        payloadJson: {
          withholdingId: created.id,
          apPaymentId: input.apPaymentId,
          status: created.status,
          decisionCode: created.decisionCode,
          isStubRate: created.isStubRate,
        },
      });
      await this.outbox.enqueue(client, {
        companyId,
        aggregateType: 'tax_withholding',
        aggregateId: created.id,
        eventType: TAX_EVENT_TYPES.WITHHOLDING_CREATED,
        payloadJson: {
          withholdingId: created.id,
          status: created.status,
          decisionCode: created.decisionCode,
          applicable: true,
          source: 'ap_payment',
        },
      });
      return serializeWithholding(created);
    };

    if (tx) return run(tx);
    return this.prisma.$transaction((inner) => run(inner));
  }

  /**
   * D286 — materialize CALCULATED withholding from ISSUED AR invoice when client RAS flag ON.
   * Idempotent on arInvoiceId. Invoice totals unchanged (RAS tracked for TEJ).
   */
  async createFromArInvoice(
    companyId: string,
    input: {
      arInvoiceId: string;
      invoiceNumber: string;
      customerId: string;
      customerName: string;
      baseAmount: number;
      currency: string;
      issuedAt: Date;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<TaxWithholdingDto | null> {
    const run = async (client: Prisma.TransactionClient) => {
      const existing = await client.taxWithholding.findFirst({
        where: {
          companyId,
          arInvoiceId: input.arInvoiceId,
          deletedAt: null,
        },
      });
      if (existing) return serializeWithholding(existing);

      const base = round3(input.baseAmount);
      if (!Number.isFinite(base) || base <= 0) return null;

      const preview = await this.expertise.previewRas(companyId, base);
      if (!preview.applied || preview.amount <= 0) return null;

      const slot = await this.expertise.getSlot(companyId, 'tax.ras');
      const stub = isStubUntilExpert(slot?.lawRef, slot?.notes);
      const wh = round3(preview.amount);
      const net = round3(base - wh);
      const periodLabel = `${input.issuedAt.getUTCFullYear()}-${String(input.issuedAt.getUTCMonth() + 1).padStart(2, '0')}`;
      const prefsSnapshot: Record<string, unknown> = {
        source: 'ar_invoice',
        arInvoiceId: input.arInvoiceId,
        invoiceNumber: input.invoiceNumber,
        customerId: input.customerId,
        slotStatus: slot?.status ?? 'MISSING',
        lawRef: slot?.lawRef ?? null,
        rateBps: preview.rateBps,
        isStub: stub,
      };
      const decisionCode = stub
        ? RAS_DECISION_CODES.PREFS_STUB
        : RAS_DECISION_CODES.FROM_AR_INVOICE;
      const decisionReason = stub
        ? `Retenue AR facture ${input.invoiceNumber} (stub démo) — validation bloquée. Base ${dec(base)} · RAS ${dec(wh)}.`
        : `Retenue AR facture ${input.invoiceNumber} ISSUED (flag client RAS). Base ${dec(base)} · ${preview.rateBps ?? '—'} bps · RAS ${dec(wh)} · net ${dec(net)}.`;

      const created = await client.taxWithholding.create({
        data: {
          companyId,
          status: TaxWithholdingStatus.CALCULATED,
          applicable: true,
          decisionReason,
          decisionCode,
          side: 'AR',
          arInvoiceId: input.arInvoiceId,
          vendorName: input.customerName.trim() || 'Client',
          baseAmount: new Prisma.Decimal(dec(base)),
          rateBps: preview.rateBps,
          withholdingAmount: new Prisma.Decimal(dec(wh)),
          netPayable: new Prisma.Decimal(dec(net)),
          currency: input.currency?.trim() || 'TND',
          lawRef: slot?.lawRef ?? null,
          periodLabel,
          prefsSnapshotJson: prefsSnapshot as Prisma.InputJsonValue,
          isStubRate: stub,
        },
      });
      await this.outbox.enqueue(client, {
        companyId,
        aggregateType: 'tax_withholding',
        aggregateId: created.id,
        eventType: TAX_EVENT_TYPES.WITHHOLDING_FROM_AR,
        payloadJson: {
          withholdingId: created.id,
          arInvoiceId: input.arInvoiceId,
          invoiceNumber: input.invoiceNumber,
          status: created.status,
          decisionCode: created.decisionCode,
          isStubRate: created.isStubRate,
        },
      });
      await this.outbox.enqueue(client, {
        companyId,
        aggregateType: 'tax_withholding',
        aggregateId: created.id,
        eventType: TAX_EVENT_TYPES.WITHHOLDING_CREATED,
        payloadJson: {
          withholdingId: created.id,
          status: created.status,
          decisionCode: created.decisionCode,
          applicable: true,
          source: 'ar_invoice',
          side: 'AR',
        },
      });
      return serializeWithholding(created);
    };

    if (tx) return run(tx);
    return this.prisma.$transaction((inner) => run(inner));
  }

  async list(
    companyId: string,
    opts?: {
      status?: TaxWithholdingStatus;
      periodLabel?: string;
      apPaymentId?: string;
      arInvoiceId?: string;
      side?: 'AP' | 'AR';
    },
  ): Promise<{ items: TaxWithholdingDto[] }> {
    const rows = await this.prisma.taxWithholding.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(opts?.status ? { status: opts.status } : {}),
        ...(opts?.periodLabel ? { periodLabel: opts.periodLabel } : {}),
        ...(opts?.apPaymentId ? { apPaymentId: opts.apPaymentId } : {}),
        ...(opts?.arInvoiceId ? { arInvoiceId: opts.arInvoiceId } : {}),
        ...(opts?.side ? { side: opts.side } : {}),
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

  /**
   * D284 — generate local RAS certificate from VALIDATED row.
   * Idempotent if already CERTIFICATE_READY with body. Never invents rates.
   */
  async generateCertificate(
    companyId: string,
    id: string,
  ): Promise<RasCertificateDto> {
    const row = await this.findScoped(companyId, id);
    if (row.isStubRate) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_STATUS,
        'Cannot issue certificate while rate is STUB_UNTIL_EXPERT.',
        HttpStatus.CONFLICT,
      );
    }
    if (
      row.status === TaxWithholdingStatus.CERTIFICATE_READY &&
      row.certificateBody &&
      row.certificateSha256 &&
      row.certificateAt
    ) {
      return {
        withholdingId: row.id,
        status: row.status,
        schemaNote: RAS_CERT_SCHEMA_NOTE,
        contentSha256: row.certificateSha256,
        generatedAt: row.certificateAt.toISOString(),
        body: row.certificateBody,
        withholding: serializeWithholding(row),
      };
    }
    if (row.status !== TaxWithholdingStatus.VALIDATED) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_STATUS,
        `Certificate requires VALIDATED status (got ${row.status}).`,
        HttpStatus.CONFLICT,
      );
    }
    if (row.applicable !== true || row.rateBps == null) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_STATUS,
        'Cannot certificate a non-applicable withholding.',
        HttpStatus.CONFLICT,
      );
    }

    const company = await this.prisma.orgCompany.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { legalName: true },
    });
    const withholderName = company?.legalName?.trim() || 'Société (nom Prefs)';
    const generatedAt = new Date();
    const body = buildLocalRasCertificate({
      withholderName,
      vendorName: row.vendorName,
      baseAmount: row.baseAmount.toString(),
      rateBps: row.rateBps,
      withholdingAmount: row.withholdingAmount.toString(),
      netPayable: row.netPayable?.toString() ?? null,
      currency: row.currency,
      lawRef: row.lawRef,
      periodLabel: row.periodLabel,
      apPaymentId: row.apPaymentId,
      withholdingId: row.id,
      generatedAt: generatedAt.toISOString(),
    });
    const sha = createHash('sha256').update(body, 'utf8').digest('hex');

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.taxWithholding.update({
        where: { id: row.id },
        data: {
          status: TaxWithholdingStatus.CERTIFICATE_READY,
          certificateBody: body,
          certificateSha256: sha,
          certificateAt: generatedAt,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'tax_withholding',
        aggregateId: next.id,
        eventType: TAX_EVENT_TYPES.WITHHOLDING_CERTIFICATE,
        payloadJson: {
          withholdingId: next.id,
          from: row.status,
          to: next.status,
          contentSha256: sha,
        },
      });
      return next;
    });

    return {
      withholdingId: updated.id,
      status: updated.status,
      schemaNote: RAS_CERT_SCHEMA_NOTE,
      contentSha256: sha,
      generatedAt: generatedAt.toISOString(),
      body,
      withholding: serializeWithholding(updated),
    };
  }

  /**
   * D287 — TEJ_PREPARED → TRANSMITTED.
   * Local human acknowledgment that the XML pack was imported into the Tej platform.
   * Never uploads / never calls Tej API.
   */
  async ackTejImport(
    companyId: string,
    id: string,
    input?: { note?: string },
  ): Promise<TaxWithholdingDto> {
    const row = await this.findScoped(companyId, id);
    if (row.status !== TaxWithholdingStatus.TEJ_PREPARED) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_STATUS,
        `Accusé import Tej requires TEJ_PREPARED (got ${row.status}).`,
        HttpStatus.CONFLICT,
      );
    }
    const note = input?.note?.trim() || null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.taxWithholding.update({
        where: { id: row.id },
        data: {
          status: TaxWithholdingStatus.TRANSMITTED,
          tejImportAckAt: new Date(),
          tejImportNote: note,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'tax_withholding',
        aggregateId: next.id,
        eventType: TAX_EVENT_TYPES.WITHHOLDING_TEJ_IMPORT_ACK,
        payloadJson: {
          withholdingId: next.id,
          from: row.status,
          to: next.status,
          transmission: 'DISABLED',
          note,
        },
      });
      return next;
    });
    return serializeWithholding(updated);
  }

  /**
   * D287 — TRANSMITTED → ACCEPTED | REJECTED (Tej platform result recorded locally).
   */
  async recordTejResult(
    companyId: string,
    id: string,
    input: {
      result: 'ACCEPTED' | 'REJECTED';
      note?: string;
      rejectReason?: string;
    },
  ): Promise<TaxWithholdingDto> {
    const row = await this.findScoped(companyId, id);
    if (row.status !== TaxWithholdingStatus.TRANSMITTED) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_STATUS,
        `Tej result requires TRANSMITTED (got ${row.status}).`,
        HttpStatus.CONFLICT,
      );
    }
    if (input.result !== 'ACCEPTED' && input.result !== 'REJECTED') {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_INPUT,
        'result must be ACCEPTED or REJECTED.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const rejectReason = input.rejectReason?.trim() || null;
    if (input.result === 'REJECTED' && !rejectReason) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_INPUT,
        'rejectReason is required when recording REJECTED.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const note = input.note?.trim() || null;
    const toStatus =
      input.result === 'ACCEPTED'
        ? TaxWithholdingStatus.ACCEPTED
        : TaxWithholdingStatus.REJECTED;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.taxWithholding.update({
        where: { id: row.id },
        data: {
          status: toStatus,
          tejImportNote: note ?? row.tejImportNote,
          tejRejectReason:
            input.result === 'REJECTED' ? rejectReason : null,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'tax_withholding',
        aggregateId: next.id,
        eventType: TAX_EVENT_TYPES.WITHHOLDING_TEJ_RESULT,
        payloadJson: {
          withholdingId: next.id,
          from: row.status,
          to: next.status,
          result: input.result,
          rejectReason:
            input.result === 'REJECTED' ? rejectReason : null,
          transmission: 'DISABLED',
        },
      });
      return next;
    });
    return serializeWithholding(updated);
  }

  /**
   * D287 — ACCEPTED | REJECTED → ARCHIVED.
   */
  async archive(
    companyId: string,
    id: string,
  ): Promise<TaxWithholdingDto> {
    const row = await this.findScoped(companyId, id);
    if (
      row.status !== TaxWithholdingStatus.ACCEPTED &&
      row.status !== TaxWithholdingStatus.REJECTED
    ) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_STATUS,
        `Archive requires ACCEPTED or REJECTED (got ${row.status}).`,
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.taxWithholding.update({
        where: { id: row.id },
        data: {
          status: TaxWithholdingStatus.ARCHIVED,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'tax_withholding',
        aggregateId: next.id,
        eventType: TAX_EVENT_TYPES.WITHHOLDING_ARCHIVED,
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

  async getCertificate(
    companyId: string,
    id: string,
  ): Promise<RasCertificateDto> {
    const row = await this.findScoped(companyId, id);
    if (
      !row.certificateBody ||
      !row.certificateSha256 ||
      !row.certificateAt
    ) {
      throw new TaxException(
        TAX_ERROR_CODES.INVALID_STATUS,
        'Certificate not generated yet — POST …/certificate first.',
        HttpStatus.CONFLICT,
      );
    }
    return {
      withholdingId: row.id,
      status: row.status,
      schemaNote: RAS_CERT_SCHEMA_NOTE,
      contentSha256: row.certificateSha256,
      generatedAt: row.certificateAt.toISOString(),
      body: row.certificateBody,
      withholding: serializeWithholding(row),
    };
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
  side?: string | null;
  supplierId: string | null;
  apBillId: string | null;
  apPaymentId: string | null;
  arInvoiceId?: string | null;
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
  certificateSha256?: string | null;
  certificateAt?: Date | null;
  certificateBody?: string | null;
  tejExportId?: string | null;
  tejImportAckAt?: Date | null;
  tejImportNote?: string | null;
  tejRejectReason?: string | null;
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
    side: row.side === 'AR' ? 'AR' : 'AP',
    supplierId: row.supplierId,
    apBillId: row.apBillId,
    apPaymentId: row.apPaymentId,
    arInvoiceId: row.arInvoiceId ?? null,
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
    certificateSha256: row.certificateSha256 ?? null,
    certificateAt: row.certificateAt?.toISOString() ?? null,
    tejExportId: row.tejExportId ?? null,
    tejImportAckAt: row.tejImportAckAt?.toISOString() ?? null,
    tejImportNote: row.tejImportNote ?? null,
    tejRejectReason: row.tejRejectReason ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildLocalRasCertificate(input: {
  withholderName: string;
  vendorName: string;
  baseAmount: string;
  rateBps: number;
  withholdingAmount: string;
  netPayable: string | null;
  currency: string;
  lawRef: string | null;
  periodLabel: string | null;
  apPaymentId: string | null;
  withholdingId: string;
  generatedAt: string;
}): string {
  const ratePct = (input.rateBps / 100).toFixed(2);
  const lines = [
    '════════════════════════════════════════════════════════════',
    '  ATTESTATION DE RETENUE À LA SOURCE — BROUILLON AUTHORITY',
    '════════════════════════════════════════════════════════════',
    '',
    RAS_CERT_SCHEMA_NOTE,
    '',
    `Émetteur (reteneur) : ${input.withholderName}`,
    `Bénéficiaire        : ${input.vendorName}`,
    `Période             : ${input.periodLabel ?? '—'}`,
    `Réf. retenue        : ${input.withholdingId}`,
    input.apPaymentId ? `Réf. décaissement AP : ${input.apPaymentId}` : null,
    '',
    `Base imposable      : ${input.baseAmount} ${input.currency}`,
    `Taux (Prefs)        : ${ratePct} % (${input.rateBps} bps)`,
    `Montant RAS         : ${input.withholdingAmount} ${input.currency}`,
    `Net versé           : ${input.netPayable ?? '—'} ${input.currency}`,
    `Réf. légale Prefs   : ${input.lawRef ?? '—'}`,
    '',
    `Généré le           : ${input.generatedAt}`,
    '',
    'Ce document est une attestation interne AUTHORITY destinée',
    'au suivi opérationnel. Il ne remplace pas un formulaire',
    'officiel du ministère des Finances et n’est pas transmis à TEJ.',
    '════════════════════════════════════════════════════════════',
  ].filter((l) => l != null);
  return lines.join('\n');
}
