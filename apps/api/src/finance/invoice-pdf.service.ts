import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DocLinkType, DocVisibility, FinInvoiceStatus } from '@prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../audit/outbox.service';
import { FINANCE_ERROR_CODES, FINANCE_EVENT_TYPES } from './finance.constants';
import { FinanceException } from './finance.exception';

export type InvoicePdfModel = {
  number: string;
  label: string | null;
  status: string;
  currency: string;
  customerName: string;
  customerCode: string | null;
  issuedAt: string | null;
  salesOrderId: string | null;
  shipmentId: string | null;
  amountHt: string;
  amountTax: string;
  amountFodec: string;
  amountTimbre: string;
  amountTotal: string;
  lines: Array<{
    lineNo: number;
    description: string;
    qty: string;
    unitPriceHt: string;
    amountHt: string;
    amountTax: string;
    amountTtc: string;
  }>;
};

/**
 * Commercial invoice PDF (D315) — HTML → Chromium, minimal layout.
 * Renders frozen invoice amounts only; FODEC/timbre shown only when > 0.
 */
@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly outbox: OutboxService,
  ) {}

  async generateAndPersist(
    companyId: string,
    actorUserId: string,
    invoiceId: string,
  ): Promise<{ buffer: Buffer; documentId: string; filename: string }> {
    const model = await this.loadModel(companyId, invoiceId);
    const html = renderInvoiceHtml(model);
    const buffer = await this.htmlToPdf(html);
    const filename = `facture-${model.number}.pdf`;

    const doc = await this.documents.createFromUpload(
      companyId,
      actorUserId,
      {
        buffer,
        mimetype: 'application/pdf',
        originalname: filename,
      },
      {
        title: `Facture ${model.number}`,
        visibility: DocVisibility.INTERNAL,
        linkType: DocLinkType.FIN_INVOICE,
        linkId: invoiceId,
      },
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.finInvoice.update({
        where: { id: invoiceId },
        data: {
          pdfDocumentId: doc.id,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'fin_invoice',
        aggregateId: invoiceId,
        eventType: FINANCE_EVENT_TYPES.INVOICE_PDF_GENERATED,
        payloadJson: {
          invoiceId,
          documentId: doc.id,
          number: model.number,
        },
      });
    });

    return { buffer, documentId: doc.id, filename };
  }

  private async loadModel(
    companyId: string,
    invoiceId: string,
  ): Promise<InvoicePdfModel> {
    const row = await this.prisma.finInvoice.findFirst({
      where: { id: invoiceId, companyId, deletedAt: null },
      include: {
        lines: {
          where: { lineType: 'PRODUCT' },
          orderBy: { lineNo: 'asc' },
        },
      },
    });
    if (!row) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVOICE_NOT_FOUND,
        'Invoice not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.status !== FinInvoiceStatus.ISSUED) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'PDF is available for ISSUED invoices only.',
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

    return {
      number: row.number,
      label: row.label,
      status: row.status,
      currency: row.currency,
      customerName:
        customer?.party.legalName?.trim() || customer?.code || row.customerId.slice(0, 8),
      customerCode: customer?.code ?? null,
      issuedAt: row.issuedAt?.toISOString().slice(0, 10) ?? null,
      salesOrderId: row.salesOrderId,
      shipmentId: row.shipmentId,
      amountHt: row.amountHt.toString(),
      amountTax: row.amountTax.toString(),
      amountFodec: row.amountFodec.toString(),
      amountTimbre: row.amountTimbre.toString(),
      amountTotal: row.amountTotal.toString(),
      lines: row.lines.map((l) => ({
        lineNo: l.lineNo,
        description: l.description,
        qty: l.qty.toString(),
        unitPriceHt: l.unitPriceHt.toString(),
        amountHt: l.amountHt.toString(),
        amountTax: l.amountTax.toString(),
        amountTtc: l.amountTtc.toString(),
      })),
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
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
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
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
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

export function renderInvoiceHtml(m: InvoicePdfModel): string {
  const fodec = Number(m.amountFodec);
  const timbre = Number(m.amountTimbre);
  const lineRows = m.lines
    .map(
      (l) => `<tr>
      <td>${l.lineNo}</td>
      <td>${esc(l.description)}</td>
      <td class="n">${esc(l.qty)}</td>
      <td class="n">${esc(l.unitPriceHt)}</td>
      <td class="n">${esc(l.amountHt)}</td>
      <td class="n">${esc(l.amountTax)}</td>
      <td class="n">${esc(l.amountTtc)}</td>
    </tr>`,
    )
    .join('\n');

  const surchargeRows: string[] = [];
  if (fodec > 0) {
    surchargeRows.push(
      `<tr><td colspan="6">FODEC</td><td class="n">${esc(m.amountFodec)}</td></tr>`,
    );
  }
  if (timbre > 0) {
    surchargeRows.push(
      `<tr><td colspan="6">Timbre</td><td class="n">${esc(m.amountTimbre)}</td></tr>`,
    );
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>Facture ${esc(m.number)}</title>
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
</style>
</head>
<body>
  <h1>Facture ${esc(m.number)}</h1>
  <p class="meta">
    ${m.label ? `${esc(m.label)} · ` : ''}${esc(m.currency)}
    ${m.issuedAt ? ` · émise ${esc(m.issuedAt)}` : ''}
  </p>
  <p>
    Client <strong>${esc(m.customerName)}</strong>
    ${m.customerCode ? ` (${esc(m.customerCode)})` : ''}
  </p>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Désignation</th><th>Qté</th><th>PU HT</th>
        <th>HT</th><th>TVA</th><th>TTC</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
      <tr><td colspan="6">Total HT</td><td class="n">${esc(m.amountHt)}</td></tr>
      <tr><td colspan="6">Total TVA</td><td class="n">${esc(m.amountTax)}</td></tr>
      ${surchargeRows.join('\n')}
      <tr class="tot"><td colspan="6">Total TTC</td><td class="n">${esc(m.amountTotal)} ${esc(m.currency)}</td></tr>
    </tbody>
  </table>
  <p class="foot">
    Document généré par AUTHORITY — montants figés sur facture émise.
    FODEC / timbre affichés uniquement si montants &gt; 0 (Prefs VALIDATED ; jamais inventés).
  </p>
</body>
</html>`;
}
