import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { MailModule } from '../mail/mail.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { SettingsModule } from '../settings/settings.module';
import { DocumentsModule } from '../documents/documents.module';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { CnssService } from './cnss.service';
import { IrppService } from './irpp.service';
import { BulletinService } from './bulletin.service';
import { BulletinPdfService } from './bulletin-pdf.service';
import { LevyService } from './levy.service';
import { JobTitleService } from './job-title.service';
import { DocKindService } from './doc-kind.service';
import { HrDocumentService } from './hr-document.service';
import { ContractPdfService } from './contract-pdf.service';
import { ContractPrintSettingsResolver } from './contract-print-settings.resolver';
import { AttestationPdfService } from './attestation-pdf.service';
import { AttestationPrintSettingsResolver } from './attestation-print-settings.resolver';
import { PrintTemplateService } from './print-template.service';
import { HrIdentityProvisionService } from './hr-identity-provision.service';
import { TransferOrderService } from './transfer-order.service';
import { TransferOrderPdfService } from './transfer-order-pdf.service';

@Module({
  imports: [
    IdentityModule,
    MailModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    AuditModule,
    SettingsModule,
    DocumentsModule,
  ],
  controllers: [HrController],
  providers: [
    HrService,
    CnssService,
    IrppService,
    BulletinService,
    BulletinPdfService,
    LevyService,
    JobTitleService,
    DocKindService,
    HrDocumentService,
    ContractPdfService,
    ContractPrintSettingsResolver,
    AttestationPdfService,
    AttestationPrintSettingsResolver,
    PrintTemplateService,
    HrIdentityProvisionService,
    TransferOrderService,
    TransferOrderPdfService,
  ],
  exports: [
    HrService,
    HrDocumentService,
    CnssService,
    IrppService,
    BulletinService,
    BulletinPdfService,
    LevyService,
    JobTitleService,
    DocKindService,
    TransferOrderService,
  ],
})
export class HrModule {}
