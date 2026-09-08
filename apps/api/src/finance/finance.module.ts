import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { AllocationEngineService } from './allocation-engine.service';
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
  ],
  controllers: [FinanceController],
  providers: [
    FinanceService,
    InvoiceService,
    PaymentService,
    AllocationEngineService,
    PromiseService,
  ],
  exports: [FinanceService, InvoiceService, PaymentService, PromiseService],
})
export class FinanceModule {}
