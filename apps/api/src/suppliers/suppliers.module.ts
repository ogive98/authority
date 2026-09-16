import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { Supplier360Service } from './supplier-360.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    MasterDataModule,
    AuditModule,
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService, Supplier360Service],
  exports: [SuppliersService, Supplier360Service],
})
export class SuppliersModule {}
