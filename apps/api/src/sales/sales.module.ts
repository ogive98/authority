import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { InventoryModule } from '../inventory/inventory.module';
import { FinanceModule } from '../finance/finance.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { WaInboxController } from './wa-inbox.controller';
import { WaInboxService } from './wa-inbox.service';

@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    AuditModule,
    InventoryModule,
    FinanceModule,
  ],
  controllers: [SalesController, WaInboxController],
  providers: [SalesService, WaInboxService],
  exports: [SalesService],
})
export class SalesModule {}
