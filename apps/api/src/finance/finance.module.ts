import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { TaxModule } from '../tax/tax.module';
import { SettingsModule } from '../settings/settings.module';
import { AccountingModule } from '../accounting/accounting.module';
import { MailModule } from '../mail/mail.module';
import { DocumentsModule } from '../documents/documents.module';
import { ApBillService } from './ap-bill.service';
import { ApPaymentService } from './ap-payment.service';
import { AllocationEngineService } from './allocation-engine.service';
import { BankingService } from './banking.service';
import { CollectionScheduleResolver } from './collection-schedule.resolver';
import { CreditNoteService } from './credit-note.service';
import { CreditPressureResolver } from './credit-pressure.resolver';
import { DunningSettingsResolver } from './dunning-settings.resolver';
import { DunningService } from './dunning.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceService } from './invoice.service';
import { PaymentDeclarationService } from './payment-declaration.service';
import { PaymentService } from './payment.service';
import { PromiseService } from './promise.service';
import { WhatsAppCloudService } from './whatsapp-cloud.service';
import { WaWebhookController } from './wa-webhook.controller';
import { WaWebhookService } from './wa-webhook.service';

@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    AuditModule,
    TaxModule,
    SettingsModule,
    AccountingModule,
    MailModule,
    DocumentsModule,
  ],
  controllers: [FinanceController, WaWebhookController],
  providers: [
    FinanceService,
    InvoiceService,
    InvoicePdfService,
    CreditNoteService,
    PaymentService,
    ApPaymentService,
    ApBillService,
    AllocationEngineService,
    PromiseService,
    PaymentDeclarationService,
    BankingService,
    DunningService,
    DunningSettingsResolver,
    WhatsAppCloudService,
    WaWebhookService,
    CollectionScheduleResolver,
    CreditPressureResolver,
  ],
  exports: [
    FinanceService,
    InvoiceService,
    InvoicePdfService,
    CreditNoteService,
    PaymentService,
    ApPaymentService,
    ApBillService,
    PromiseService,
    PaymentDeclarationService,
    BankingService,
    DunningService,
    CollectionScheduleResolver,
    CreditPressureResolver,
  ],
})
export class FinanceModule {}
