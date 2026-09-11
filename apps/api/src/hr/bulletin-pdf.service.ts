import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DocLinkType, DocVisibility } from '@prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { HR_ERROR_CODES, HR_EVENT_TYPES } from './hr.constants';
import { HrException } from './hr.exception';
import { OutboxService } from '../audit/outbox.service';

export type BulletinPdfModel = {
  number: string;
  periodYm: string;
  employeeName: string;
  matricule: string;
  contractNumber: string;
  wageBase: string;
  cnssEmployeeAmount: string;
  cnssEmployerAmount: string;
  irppMonthly: string;
  netPay: string;
  currency: string;
  annualTaxableBeforeAbat: string | null;
  abatChefAnnual: string | null;
  abatEnfantAnnual: string | null;
  abatTotalAnnual: string | null;
  taxChefDeFamille: boolean | null;
  taxEnfantCount: number | null;
};

/**
 * Server PDF for HR bulletin (D202) — HTML → Chromium, minimal legal layout.
 * Never invents amounts; renders frozen bulletin + IRPP snapshot abatements.
 */
@Injectable()
export class BulletinPdfService {
  private readonly logger = new Logger(BulletinPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly outbox: OutboxService,
  ) {}

  async generateAndPersist(
    companyId: string,
    actorUserId: string,
    bulletinId: string,
  ): Promise<{ buffer: Buffer; documentId: string; filename: string }> {
    const model = await this.loadModel(companyId, bulletinId);
    const html = renderMinimalLegalHtml(model);
    const buffer = await this.htmlToPdf(html);
    const filename = `bulletin-${model.number}.pdf`;

    const doc = await this.documents.createFromUpload(
      companyId,
      actorUserId,
      {
        buffer,
        mimetype: 'application/pdf',
        originalname: filename,
      },
      {
        title: `Bulletin ${model.number} — ${model.periodYm}`,
        visibility: DocVisibility.INTERNAL,
        linkType: DocLinkType.HR_BULLETIN,
        linkId: bulletinId,
      },
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.hrBulletin.update({
        where: { id: bulletinId },
        data: {
          pdfDocumentId: doc.id,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'hr_bulletin',
        aggregateId: bulletinId,
        eventType: HR_EVENT_TYPES.BULLETIN_PDF_GENERATED,
        payloadJson: {
          bulletinId,
          documentId: doc.id,
          number: model.number,
        },
      });
    });

    return { buffer, documentId: doc.id, filename };
  }

  private async loadModel(
    companyId: string,
    bulletinId: string,
  ): Promise<BulletinPdfModel> {
    const row = await this.prisma.hrBulletin.findFirst({
      where: { id: bulletinId, companyId, deletedAt: null },
      include: {
        employee: { select: { displayName: true, matricule: true } },
        contract: { select: { number: true } },
      },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.BULLETIN_NOT_FOUND,
        'Bulletin not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const irpp = row.irppSnapshotId
      ? await this.prisma.hrIrppSnapshot.findFirst({
          where: {
            id: row.irppSnapshotId,
            companyId,
            deletedAt: null,
          },
        })
      : null;

    return {
      number: row.number,
      periodYm: row.periodYm,
      employeeName: row.employee.displayName,
      matricule: row.employee.matricule,
      contractNumber: row.contract.number,
      wageBase: row.wageBase.toFixed(3),
      cnssEmployeeAmount: row.cnssEmployeeAmount.toFixed(3),
      cnssEmployerAmount: row.cnssEmployerAmount.toFixed(3),
      irppMonthly: row.irppMonthly.toFixed(3),
      netPay: row.netPay.toFixed(3),
      currency: row.currency,
      annualTaxableBeforeAbat: irpp
        ? irpp.annualTaxableBeforeAbat.toFixed(3)
        : null,
      abatChefAnnual: irpp ? irpp.abatChefAnnual.toFixed(3) : null,
      abatEnfantAnnual: irpp ? irpp.abatEnfantAnnual.toFixed(3) : null,
      abatTotalAnnual: irpp ? irpp.abatTotalAnnual.toFixed(3) : null,
      taxChefDeFamille: irpp?.taxChefDeFamille ?? null,
      taxEnfantCount: irpp?.taxEnfantCount ?? null,
    };
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    let playwright: typeof import('playwright');
    try {
      playwright = await import('playwright');
    } catch {
      throw new HrException(
        HR_ERROR_CODES.BULLETIN_PDF_UNAVAILABLE,
        'Playwright is not installed — run npm install in apps/api.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let browser;
    try {
      browser = await playwright.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Chromium launch failed';
      this.logger.warn(`PDF Chromium unavailable: ${msg}`);
      throw new HrException(
        HR_ERROR_CODES.BULLETIN_PDF_UNAVAILABLE,
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
        margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => undefined);
    }
  }
}

/** Minimal legal HTML (lock 9B) — not Soft Glass chrome. */
export function renderMinimalLegalHtml(m: BulletinPdfModel): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const abatRows: string[] = [];
  if (m.abatTotalAnnual != null && Number(m.abatTotalAnnual) > 0) {
    if (m.annualTaxableBeforeAbat) {
      abatRows.push(
        `<tr><td>Assiette annuelle avant abattements</td><td class="n">${esc(m.annualTaxableBeforeAbat)}</td></tr>`,
      );
    }
    if (m.abatChefAnnual && Number(m.abatChefAnnual) > 0) {
      abatRows.push(
        `<tr><td>Abattement chef de famille (annuel)${m.taxChefDeFamille === true ? '' : ''}</td><td class="n">− ${esc(m.abatChefAnnual)}</td></tr>`,
      );
    }
    if (m.abatEnfantAnnual && Number(m.abatEnfantAnnual) > 0) {
      const kids =
        m.taxEnfantCount != null ? ` (${m.taxEnfantCount} enf.)` : '';
      abatRows.push(
        `<tr><td>Abattement enfants (annuel)${kids}</td><td class="n">− ${esc(m.abatEnfantAnnual)}</td></tr>`,
      );
    }
    abatRows.push(
      `<tr><td>Total abattements annuels</td><td class="n">− ${esc(m.abatTotalAnnual)}</td></tr>`,
    );
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<title>Bulletin ${esc(m.number)}</title>
<style>
  body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #111; }
  h1 { font-size: 14pt; margin: 0 0 4pt; }
  .meta { color: #444; margin-bottom: 14pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 10pt; }
  th, td { border-bottom: 1px solid #ccc; padding: 6pt 4pt; text-align: left; }
  th { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
  td.n { text-align: right; font-variant-numeric: tabular-nums; font-family: "Courier New", monospace; }
  .net td { font-weight: bold; font-size: 12pt; border-bottom: none; padding-top: 10pt; }
  .foot { margin-top: 18pt; font-size: 8pt; color: #666; line-height: 1.35; }
</style>
</head>
<body>
  <h1>Bulletin de paie — ${esc(m.number)}</h1>
  <p class="meta">Période ${esc(m.periodYm)} · ${esc(m.currency)}</p>
  <p>
    Matricule <strong>${esc(m.matricule)}</strong><br/>
    Employé <strong>${esc(m.employeeName)}</strong><br/>
    Contrat <strong>${esc(m.contractNumber)}</strong>
  </p>
  <table>
    <thead><tr><th>Libellé</th><th>Montant (${esc(m.currency)})</th></tr></thead>
    <tbody>
      <tr><td>Base salariale</td><td class="n">${esc(m.wageBase)}</td></tr>
      <tr><td>CNSS salarié</td><td class="n">− ${esc(m.cnssEmployeeAmount)}</td></tr>
      <tr><td>CNSS employeur (info)</td><td class="n">${esc(m.cnssEmployerAmount)}</td></tr>
      ${abatRows.join('\n')}
      <tr><td>IRPP mensuel</td><td class="n">− ${esc(m.irppMonthly)}</td></tr>
      <tr class="net"><td>Net à payer</td><td class="n">${esc(m.netPay)} ${esc(m.currency)}</td></tr>
    </tbody>
  </table>
  <p class="foot">
    Document généré par AUTHORITY — montants issus des snapshots CNSS / IRPP VALIDATED
    (aucun barème inventé). Abattements appliqués sur l’assiette annuelle avant barème
    progressif lorsque les sièges Prefs sont VALIDATED. Net = base − CNSS salarié − IRPP mensuel.
  </p>
</body>
</html>`;
}
