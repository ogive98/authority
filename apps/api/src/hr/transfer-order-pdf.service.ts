import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DocLinkType, DocVisibility } from '@prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfRendererService } from '../common/pdf-renderer.service';
import { HR_ERROR_CODES, HR_EVENT_TYPES } from './hr.constants';
import { HrException } from './hr.exception';

export type TransferOrderPdfModel = {
  number: string;
  status: string;
  amount: string;
  currency: string;
  periodYm: string;
  bulletinNumber: string;
  beneficiaryName: string;
  matricule: string;
  beneficiaryBankName: string;
  beneficiaryBankAgency: string;
  beneficiaryBankAccount: string;
  companyBankCode: string;
  companyBankLabel: string;
  companyBankRib: string;
  confirmedAt: string | null;
  apPaymentNumber: string | null;
};

/**
 * PDF ordre de virement (D222) — HTML → Chromium, factual frozen fields only.
 */
@Injectable()
export class TransferOrderPdfService {
  private readonly logger = new Logger(TransferOrderPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly outbox: OutboxService,
    private readonly pdfRenderer: PdfRendererService,
  ) {}

  async generateAndPersist(
    companyId: string,
    actorUserId: string,
    transferOrderId: string,
  ): Promise<{ buffer: Buffer; documentId: string; filename: string }> {
    const model = await this.loadModel(companyId, transferOrderId);
    const html = renderTransferOrderHtml(model);
    const buffer = await this.htmlToPdf(html);
    const filename = `ordre-virement-${model.number}.pdf`;

    const doc = await this.documents.createFromUpload(
      companyId,
      actorUserId,
      {
        buffer,
        mimetype: 'application/pdf',
        originalname: filename,
      },
      {
        title: `Ordre de virement ${model.number}`,
        visibility: DocVisibility.INTERNAL,
        linkType: DocLinkType.HR_TRANSFER_ORDER,
        linkId: transferOrderId,
      },
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.hrTransferOrder.update({
        where: { id: transferOrderId },
        data: {
          pdfDocumentId: doc.id,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'hr_transfer_order',
        aggregateId: transferOrderId,
        eventType: HR_EVENT_TYPES.TRANSFER_PDF_GENERATED,
        payloadJson: {
          transferOrderId,
          documentId: doc.id,
          number: model.number,
        },
      });
    });

    return { buffer, documentId: doc.id, filename };
  }

  private async loadModel(
    companyId: string,
    transferOrderId: string,
  ): Promise<TransferOrderPdfModel> {
    const row = await this.prisma.hrTransferOrder.findFirst({
      where: { id: transferOrderId, companyId, deletedAt: null },
      include: {
        bulletin: { select: { number: true, periodYm: true } },
        employee: { select: { matricule: true } },
        apPayment: { select: { number: true } },
      },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_NOT_FOUND,
        'Transfer order not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      number: row.number,
      status: row.status,
      amount: row.amount.toFixed(3),
      currency: row.currency,
      periodYm: row.bulletin.periodYm,
      bulletinNumber: row.bulletin.number,
      beneficiaryName: row.beneficiaryName,
      matricule: row.employee.matricule,
      beneficiaryBankName: row.beneficiaryBankName ?? '—',
      beneficiaryBankAgency: row.beneficiaryBankAgency ?? '—',
      beneficiaryBankAccount: row.beneficiaryBankAccount,
      companyBankCode: row.companyBankCode,
      companyBankLabel: row.companyBankLabel,
      companyBankRib: row.companyBankRib ?? '—',
      confirmedAt: row.confirmedAt?.toISOString().slice(0, 10) ?? null,
      apPaymentNumber: row.apPayment?.number ?? null,
    };
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    try {
      return await this.pdfRenderer.render(html);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`pdf render failed: ${msg}`);
      throw new HrException(
        HR_ERROR_CODES.TRANSFER_PDF_UNAVAILABLE,
        msg,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}

export function renderTransferOrderHtml(m: TransferOrderPdfModel): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>Ordre de virement ${esc(m.number)}</title>
<style>
  body { font-family: Georgia, serif; font-size: 12pt; color: #111; }
  h1 { font-size: 16pt; margin: 0 0 8px; }
  .meta { color: #444; font-size: 10pt; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { text-align: left; padding: 6px 4px; border-bottom: 1px solid #ddd; vertical-align: top; }
  th { width: 38%; color: #555; font-weight: normal; font-size: 10pt; }
  .n { font-family: 'Courier New', monospace; }
  .amount { font-size: 14pt; font-weight: bold; }
</style>
</head>
<body>
  <h1>Ordre de virement</h1>
  <p class="meta">AUTHORITY · RH · ${esc(m.number)} · statut ${esc(m.status)}</p>
  <table>
    <tr><th>Période / bulletin</th><td class="n">${esc(m.periodYm)} · ${esc(m.bulletinNumber)}</td></tr>
    <tr><th>Bénéficiaire</th><td>${esc(m.beneficiaryName)} <span class="n">(${esc(m.matricule)})</span></td></tr>
    <tr><th>Banque bénéficiaire</th><td>${esc(m.beneficiaryBankName)} · ${esc(m.beneficiaryBankAgency)}</td></tr>
    <tr><th>RIB / compte</th><td class="n">${esc(m.beneficiaryBankAccount)}</td></tr>
    <tr><th>Compte société (débit)</th><td>${esc(m.companyBankLabel)} <span class="n">(${esc(m.companyBankCode)})</span></td></tr>
    <tr><th>RIB société</th><td class="n">${esc(m.companyBankRib)}</td></tr>
    <tr><th>Montant</th><td class="n amount">${esc(m.amount)} ${esc(m.currency)}</td></tr>
    ${
      m.confirmedAt
        ? `<tr><th>Confirmé le</th><td class="n">${esc(m.confirmedAt)}</td></tr>`
        : ''
    }
    ${
      m.apPaymentNumber
        ? `<tr><th>Décaissement AP</th><td class="n">${esc(m.apPaymentNumber)}</td></tr>`
        : ''
    }
  </table>
  <p class="meta" style="margin-top:24px">Document factuel — montant = net bulletin figé. Aucun taux inventé.</p>
</body>
</html>`;
}
