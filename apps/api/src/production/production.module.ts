import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import { ProductionWorksheetService } from './production.worksheet.service';

@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    AuditModule,
    InventoryModule,
  ],
  controllers: [ProductionController],
  providers: [ProductionService, ProductionWorksheetService],
  exports: [ProductionService, ProductionWorksheetService],
})
export class ProductionModule {}
