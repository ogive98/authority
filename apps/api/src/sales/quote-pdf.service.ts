import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DocLinkType, DocVisibility, SalQuoteStatus } from '@prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../audit/outbox.service';
import { SALES_ERROR_CODES, SALES_EVENT_TYPES } from './sales.constants';
import { SalesException } from './sales.exception';

export type QuotePdfModel = {
  number: string;
  status: string;
  currency: string;
  customerName: string;
  customerCode: string | null;
  validUntil: string | null;
  notes: string | null;
  amountTotal: string;
  lines: Array<{
    lineNo: number;
    description: string;
    qty: string;
    unitPrice: string;
    discountPct: string;
    lineTotal: string;
  }>;
};

const PDF_ALLOWED: ReadonlySet<SalQuoteStatus> = new Set([
  SalQuoteStatus.DRAFT,
  SalQuoteStatus.SENT,
  SalQuoteStatus.ACCEPTED,
]);

/**
 * Sales quote PDF (D318) — HTML → Chromium, mirrors invoice PDF pattern (D315).
 * Commercial amounts only (no tax invention).
 */
@Injectable()
export class QuotePdfService {
  private readonly logger = new Logger(QuotePdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly outbox: OutboxService,
  ) {}

  async generateAndPersist(
    companyId: string,
    actorUserId: string,
    quoteId: string,
    opts: { visibility?: DocVisibility } = {},
  ): Promise<{ buffer: Buffer; documentId: string; filename: string }> {
    const visibility = opts.visibility ?? DocVisibility.INTERNAL;
    const model = await this.loadModel(companyId, quoteId);
    const html = renderQuoteHtml(model);
    const buffer = await this.htmlToPdf(html);
    const filename = `devis-${model.number}.pdf`;

    const doc = await this.documents.createFromUpload(
      companyId,
      actorUserId,
      {
        buffer,
        mimetype: 'application/pdf',
        originalname: filename,
      },
      {
        title: `Devis ${model.number}`,
        visibility,
        linkType: DocLinkType.SAL_QUOTE,
        linkId: quoteId,
      },
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.salQuote.update({
        where: { id: quoteId },
        data: {
          pdfDocumentId: doc.id,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'sal_quote',
        aggregateId: quoteId,
        eventType: SALES_EVENT_TYPES.QUOTE_PDF_GENERATED,
        payloadJson: {
          quoteId,
          documentId: doc.id,
          number: model.number,
          visibility,
        },
      });
    });

    return { buffer, documentId: doc.id, filename };
  }

  /** Publish quote PDF to customer portal (CUSTOMER_PORTAL visibility). */
  async publishToPortal(
    companyId: string,
    actorUserId: string,
    quoteId: string,
  ): Promise<{ documentId: string; number: string; customerId: string }> {
    const result = await this.generateAndPersist(companyId, actorUserId, quoteId, {
      visibility: DocVisibility.CUSTOMER_PORTAL,
    });
    const quote = await this.prisma.salQuote.findFirst({
      where: { id: quoteId, companyId, deletedAt: null },
      select: { customerId: true, number: true },
    });
    if (!quote) {
      throw new SalesException(
        SALES_ERROR_CODES.NOT_FOUND,
        'Quote not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'sal_quote',
        aggregateId: quoteId,
        eventType: SALES_EVENT_TYPES.QUOTE_PUBLISHED_PORTAL,
        payloadJson: {
          quoteId,
          documentId: result.documentId,
          number: quote.number,
          customerId: quote.customerId,
        },
      });
    });
    return {
      documentId: result.documentId,
      number: quote.number,
      customerId: quote.customerId,
    };
  }

  private async loadModel(
    companyId: string,
    quoteId: string,
  ): Promise<QuotePdfModel> {
    const row = await this.prisma.salQuote.findFirst({
      where: { id: quoteId, companyId, deletedAt: null },
      include: {
        lines: { orderBy: { lineNo: 'asc' } },
      },
    });
    if (!row) {
      throw new SalesException(
        SALES_ERROR_CODES.NOT_FOUND,
        'Quote not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!PDF_ALLOWED.has(row.status)) {
      throw new SalesException(
        SALES_ERROR_CODES.INVALID_STATUS,
        'PDF is available for DRAFT, SENT, or ACCEPTED quotes only.',
        HttpStatus.CONFLICT,
      );
    }

    const customer = await this.prisma.cusCustomer.findFirst({
      where: { id: row.customerId, companyId, deletedAt: null },
      select: {
        code: true,
        party: { select: { legalName: true } },
      },
    });

    const productIds = [...new Set(row.lines.map((l) => l.productId))];
    const products =
      productIds.length === 0
        ? []
        : await this.prisma.prdProduct.findMany({
            where: { companyId, id: { in: productIds } },
            select: { id: true, sku: true, name: true },
          });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return {
      number: row.number,
      status: row.status,
      currency: row.currency,
      customerName:
        customer?.party.legalName?.trim() ||
        customer?.code ||
        row.customerId.slice(0, 8),
      customerCode: customer?.code ?? null,
      validUntil: row.validUntil
        ? row.validUntil.toISOString().slice(0, 10)
        : null,
      notes: row.notes,
      amountTotal: row.amountTotal.toString(),
      lines: row.lines.map((l) => {
        const p = productMap.get(l.productId);
        const label = p
          ? `${p.sku} — ${p.name}`
          : l.productId.slice(0, 8);
        return {
          lineNo: l.lineNo,
          description: label,
          qty: l.qty.toString(),
          unitPrice: l.unitPrice.toString(),
          discountPct: l.discountPct.toString(),
          lineTotal: l.lineTotal.toString(),
        };
      }),
    };
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    let playwright: typeof import('playwright');
    try {
      playwright = await import('playwright');
    } catch (error) {
      this.logger.error(
        `playwright import failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new SalesException(
        SALES_ERROR_CODES.INVALID_STATUS,
        'PDF engine unavailable.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    let browser;
    try {
      browser = await playwright.chromium.launch({
        headless: true,
      });
    } catch (error) {
      this.logger.error(
        `chromium launch failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new SalesException(
        SALES_ERROR_CODES.INVALID_STATUS,
        'Chromium unavailable for PDF — run npx playwright install chromium.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderQuoteHtml(m: QuotePdfModel): string {
  const lineRows = m.lines
    .map(
      (l) => `<tr>
      <td>${l.lineNo}</td>
      <td>${esc(l.description)}</td>
      <td class="n">${esc(l.qty)}</td>
      <td class="n">${esc(l.unitPrice)}</td>
      <td class="n">${esc(l.discountPct)}</td>
      <td class="n">${esc(l.lineTotal)}</td>
    </tr>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>Devis ${esc(m.number)}</title>
<style>
  body { font-family: system-ui, sans-serif; font-size: 10.5pt; color: #14161a; }
  h1 { font-size: 16pt; margin: 0 0 6pt; color: #2f5fdd; }
  .meta { color: #5c6570; margin-bottom: 12pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 10pt; }
  th, td { border-bottom: 1px solid #d8dde5; padding: 6pt 4pt; text-align: left; }
  th { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; color: #5c6570; }
  td.n { text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, monospace; }
  .tot td { font-weight: 600; border-bottom: none; padding-top: 10pt; }
  .foot { margin-top: 16pt; font-size: 8pt; color: #5c6570; line-height: 1.35; }
  .notes { margin-top: 12pt; white-space: pre-wrap; }
</style>
</head>
<body>
  <h1>Devis ${esc(m.number)}</h1>
  <p class="meta">
    ${esc(m.status)} · ${esc(m.currency)}
    ${m.validUntil ? ` · validité ${esc(m.validUntil)}` : ''}
  </p>
  <p>
    Client <strong>${esc(m.customerName)}</strong>
    ${m.customerCode ? ` (${esc(m.customerCode)})` : ''}
  </p>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Désignation</th><th>Qté</th><th>PU</th>
        <th>Remise %</th><th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
      <tr class="tot"><td colspan="5">Total</td><td class="n">${esc(m.amountTotal)} ${esc(m.currency)}</td></tr>
    </tbody>
  </table>
  ${
    m.notes?.trim()
      ? `<p class="notes"><strong>Notes</strong><br/>${esc(m.notes.trim())}</p>`
      : ''
  }
  <p class="foot">
    Document généré par AUTHORITY — proposition commerciale (hors TVA inventée).
    Montants figés sur le devis ; FODEC / timbre / barèmes = Prefs VALIDATED uniquement (jamais inventés).
  </p>
</body>
</html>`;
}
