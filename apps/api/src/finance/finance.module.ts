import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { TaxModule } from '../tax/tax.module';
import { SettingsModule } from '../settings/settings.module';
import { AllocationEngineService } from './allocation-engine.service';
import { BankingService } from './banking.service';
import { CollectionScheduleResolver } from './collection-schedule.resolver';
import { CreditPressureResolver } from './credit-pressure.resolver';
import { DunningService } from './dunning.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { InvoiceService } from './invoice.service';
import { PaymentService } from './payment.service';
import { PromiseService } from './promise.service';

@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    AuditModule,
    TaxModule,
    SettingsModule,
  ],
  controllers: [FinanceController],
  providers: [
    FinanceService,
    InvoiceService,
    PaymentService,
    AllocationEngineService,
    PromiseService,
    BankingService,
    DunningService,
    CollectionScheduleResolver,
    CreditPressureResolver,
  ],
  exports: [
    FinanceService,
    InvoiceService,
    PaymentService,
    PromiseService,
    BankingService,
    DunningService,
    CollectionScheduleResolver,
    CreditPressureResolver,
  ],
})
export class FinanceModule {}
