import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { FinanceGlPostingService } from './finance-gl-posting.service';

@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    AuditModule,
  ],
  controllers: [AccountingController],
  providers: [AccountingService, FinanceGlPostingService],
  exports: [AccountingService, FinanceGlPostingService],
})
export class AccountingModule {}
