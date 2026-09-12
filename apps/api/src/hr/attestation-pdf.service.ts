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
import { AttestationPrintSettingsResolver } from './attestation-print-settings.resolver';
import { PrintTemplateService } from './print-template.service';
import { type HrPrintMergeFields } from './hr-print-merge';
import { HR_BRAND, renderHrPrintDocument } from './hr-print-layout';

export type AttestationPdfModel = HrPrintMergeFields & {
  letterhead: string;
  bodyHtml: string;
  footer: string;
};

/**
 * Work attestation PDF (D217) — requires ACTIVE contract.
 * Prefs skeleton or catalogue template; never invents legal formulas.
 */
@Injectable()
export class AttestationPdfService {
  private readonly logger = new Logger(AttestationPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly outbox: OutboxService,
    private readonly printSettings: AttestationPrintSettingsResolver,
    private readonly printTemplates: PrintTemplateService,
  ) {}

  async generateAndPersist(
    companyId: string,
    actorUserId: string,
    employeeId: string,
    templateId?: string,
    override?: { letterhead?: string; bodyHtml?: string; footer?: string },
  ): Promise<{ buffer: Buffer; documentId: string; filename: string }> {
    const model = await this.loadModel(
      companyId,
      employeeId,
      templateId,
      override,
    );
    const html = renderAttestationHtml(model);
    const buffer = await this.htmlToPdf(html);
    const filename = `attestation-${model.matricule}.pdf`;

    const doc = await this.documents.createFromUpload(
      companyId,
      actorUserId,
      {
        buffer,
        mimetype: 'application/pdf',
        originalname: filename,
      },
      {
        title: `Attestation ${model.matricule}`,
        visibility: DocVisibility.INTERNAL,
        linkType: DocLinkType.HR_ATTESTATION,
        linkId: employeeId,
      },
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.hrEmployee.update({
        where: { id: employeeId },
        data: {
          attestationPdfDocumentId: doc.id,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'hr_employee',
        aggregateId: employeeId,
        eventType: HR_EVENT_TYPES.ATTESTATION_PDF_GENERATED,
        payloadJson: {
          employeeId,
          documentId: doc.id,
          matricule: model.matricule,
          templateId: templateId ?? null,
        },
      });
    });

    return { buffer, documentId: doc.id, filename };
  }

  private async loadModel(
    companyId: string,
    employeeId: string,
    templateId?: string,
    override?: { letterhead?: string; bodyHtml?: string; footer?: string },
  ): Promise<AttestationPdfModel> {
    const emp = await this.prisma.hrEmployee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      include: {
        jobTitle: { select: { name: true } },
        contracts: {
          where: { deletedAt: null, status: HrContractStatus.ACTIVE },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
    });
    if (!emp) {
      throw new HrException(
        HR_ERROR_CODES.EMPLOYEE_NOT_FOUND,
        'Employee not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const contract = emp.contracts[0];
    if (!contract) {
      throw new HrException(
        HR_ERROR_CODES.ATTESTATION_REQUIRES_ACTIVE_CONTRACT,
        'Attestation requires an ACTIVE contract.',
        HttpStatus.CONFLICT,
      );
    }

    const company = await this.prisma.orgCompany.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { legalName: true, vatNumber: true },
    });
    const catalogue = await this.printTemplates.resolveForGenerate(
      companyId,
      HrPrintDocKind.ATTESTATION,
      templateId,
    );
    const tpl = catalogue ?? (await this.printSettings.getTemplate(companyId));

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
      contractNumber: contract.number,
      contractType: contract.type,
      startDate: contract.startDate.toISOString().slice(0, 10),
      endDate: contract.endDate
        ? contract.endDate.toISOString().slice(0, 10)
        : '',
      wageRef: contract.wageRef ?? '',
      wageBase:
        contract.wageBase != null ? contract.wageBase.toFixed(3) : '',
      notes: emp.notes ?? '',
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
        HR_ERROR_CODES.ATTESTATION_PDF_UNAVAILABLE,
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
      this.logger.warn(`Attestation PDF Chromium unavailable: ${msg}`);
      throw new HrException(
        HR_ERROR_CODES.ATTESTATION_PDF_UNAVAILABLE,
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

export function renderAttestationHtml(m: AttestationPdfModel): string {
  return renderHrPrintDocument({
    kind: 'attestation',
    title: 'Attestation de travail',
    subtitle: m.employeeName,
    fields: m,
    rows: [
      { label: 'Salarié', value: `${m.employeeName} (${m.matricule})` },
      { label: 'CIN', value: m.cinNo || '—', mono: true },
      { label: 'CNSS', value: m.cnssNo || '—', mono: true },
      { label: 'Adresse', value: m.address || '—' },
      { label: 'Poste', value: m.jobTitle || '—' },
      {
        label: 'Contrat',
        value: `${m.contractType} ${m.contractNumber}`.trim(),
      },
      { label: 'Depuis', value: m.startDate, mono: true },
      { label: 'Embauche', value: m.hiredAt || '—', mono: true },
    ],
    bodyHtml: m.bodyHtml,
    emptyBodyNote:
      'Compléter le corps du document dans le tiroir de génération — aucune formule légale inventée.',
  });
}
