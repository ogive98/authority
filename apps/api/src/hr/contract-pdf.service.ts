import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  DocLinkType,
  DocVisibility,
  HrContractStatus,
  HrPrintDocKind,
} from '@prisma/client';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../audit/outbox.service';
import { HR_ERROR_CODES, HR_EVENT_TYPES } from './hr.constants';
import { HrException } from './hr.exception';
import { ContractPrintSettingsResolver } from './contract-print-settings.resolver';
import { PrintTemplateService } from './print-template.service';
import { type HrPrintMergeFields } from './hr-print-merge';
import { HR_BRAND, renderHrPrintDocument } from './hr-print-layout';

export type ContractPdfModel = HrPrintMergeFields & {
  letterhead: string;
  bodyHtml: string;
  footer: string;
};

/**
 * Contract PDF (D216/D217) — factual fields + Prefs skeleton or catalogue template.
 * Never invents Tunisian legal clauses.
 */
@Injectable()
export class ContractPdfService {
  private readonly logger = new Logger(ContractPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly outbox: OutboxService,
    private readonly printSettings: ContractPrintSettingsResolver,
    private readonly printTemplates: PrintTemplateService,
  ) {}

  async generateAndPersist(
    companyId: string,
    actorUserId: string,
    contractId: string,
    templateId?: string,
    override?: { letterhead?: string; bodyHtml?: string; footer?: string },
  ): Promise<{ buffer: Buffer; documentId: string; filename: string }> {
    const model = await this.loadModel(
      companyId,
      contractId,
      templateId,
      override,
    );
    const html = renderContractHtml(model);
    const buffer = await this.htmlToPdf(html);
    const filename = `contrat-${model.contractNumber}.pdf`;

    const doc = await this.documents.createFromUpload(
      companyId,
      actorUserId,
      {
        buffer,
        mimetype: 'application/pdf',
        originalname: filename,
      },
      {
        title: `Contrat ${model.contractNumber}`,
        visibility: DocVisibility.INTERNAL,
        linkType: DocLinkType.HR_CONTRACT,
        linkId: contractId,
      },
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.hrContract.update({
        where: { id: contractId },
        data: {
          pdfDocumentId: doc.id,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'hr_contract',
        aggregateId: contractId,
        eventType: HR_EVENT_TYPES.CONTRACT_PDF_GENERATED,
        payloadJson: {
          contractId,
          documentId: doc.id,
          number: model.contractNumber,
          templateId: templateId ?? null,
        },
      });
    });

    return { buffer, documentId: doc.id, filename };
  }

  private async loadModel(
    companyId: string,
    contractId: string,
    templateId?: string,
    override?: { letterhead?: string; bodyHtml?: string; footer?: string },
  ): Promise<ContractPdfModel> {
    const row = await this.prisma.hrContract.findFirst({
      where: { id: contractId, companyId, deletedAt: null },
      include: {
        employee: {
          select: {
            displayName: true,
            matricule: true,
            cnssNo: true,
            cinNo: true,
            address: true,
            bankName: true,
            bankAgency: true,
            bankAccount: true,
            department: true,
            hiredAt: true,
            notes: true,
            jobTitle: { select: { name: true } },
          },
        },
      },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.CONTRACT_NOT_FOUND,
        'Contract not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.status !== HrContractStatus.ACTIVE) {
      throw new HrException(
        HR_ERROR_CODES.INVALID_STATUS,
        'PDF generation is limited to ACTIVE contracts.',
        HttpStatus.CONFLICT,
      );
    }

    const company = await this.prisma.orgCompany.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { legalName: true, vatNumber: true },
    });
    const catalogue = await this.printTemplates.resolveForGenerate(
      companyId,
      HrPrintDocKind.CONTRACT,
      templateId,
    );
    const tpl = catalogue ?? (await this.printSettings.getTemplate(companyId));
    const emp = row.employee;

    return {
      companyName: HR_BRAND.legalName || company?.legalName || '',
      vatNumber: HR_BRAND.taxId || company?.vatNumber || '',
      employeeName: emp.displayName,
      matricule: emp.matricule,
      cnssNo: emp.cnssNo ?? '',
      cinNo: emp.cinNo ?? '',
      address: emp.address ?? '',
      bankName: emp.bankName ?? '',
      bankAgency: emp.bankAgency ?? '',
      bankAccount: emp.bankAccount ?? '',
      jobTitle: emp.jobTitle?.name ?? '',
      department: emp.department ?? '',
      contractNumber: row.number,
      contractType: row.type,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : '',
      wageRef: row.wageRef ?? '',
      wageBase: row.wageBase != null ? row.wageBase.toFixed(3) : '',
      notes: row.notes ?? '',
      hiredAt: emp.hiredAt ? emp.hiredAt.toISOString().slice(0, 10) : '',
      letterhead: (override?.letterhead ?? tpl.letterhead).trim(),
      bodyHtml: (override?.bodyHtml ?? tpl.bodyHtml).trim(),
      footer: (override?.footer ?? tpl.footer).trim(),
    };
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    let playwright: typeof import('playwright');
    try {
      playwright = await import('playwright');
    } catch {
      throw new HrException(
        HR_ERROR_CODES.CONTRACT_PDF_UNAVAILABLE,
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
      this.logger.warn(`Contract PDF Chromium unavailable: ${msg}`);
      throw new HrException(
        HR_ERROR_CODES.CONTRACT_PDF_UNAVAILABLE,
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

export function renderContractHtml(m: ContractPdfModel): string {
  return renderHrPrintDocument({
    kind: 'contract',
    title: `Contrat ${m.contractNumber}`,
    subtitle: `${m.contractType} · ${m.employeeName}`,
    fields: m,
    rows: [
      { label: 'Salarié', value: `${m.employeeName} (${m.matricule})` },
      { label: 'CIN', value: m.cinNo || '—', mono: true },
      { label: 'CNSS', value: m.cnssNo || '—', mono: true },
      { label: 'Adresse', value: m.address || '—' },
      {
        label: 'Banque',
        value:
          [m.bankName, m.bankAgency, m.bankAccount].filter(Boolean).join(' · ') ||
          '—',
      },
      { label: 'Type', value: m.contractType },
      { label: 'Début', value: m.startDate, mono: true },
      { label: 'Fin', value: m.endDate || '—', mono: true },
      { label: 'Réf. salaire', value: m.wageRef || '—' },
      { label: 'Base TND', value: m.wageBase || '—', mono: true },
      ...(m.notes ? [{ label: 'Notes', value: m.notes }] : []),
    ],
    bodyHtml: m.bodyHtml,
    emptyBodyNote:
      'Compléter le corps du document dans le tiroir de génération — aucune clause légale inventée.',
  });
}
