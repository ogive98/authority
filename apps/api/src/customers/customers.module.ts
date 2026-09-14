import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { FinanceModule } from '../finance/finance.module';
import { Customer360Service } from './customer-360.service';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PortalMembershipService } from './portal-membership.service';

@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    MasterDataModule,
    AuditModule,
    FinanceModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService, Customer360Service, PortalMembershipService],
  exports: [CustomersService, Customer360Service, PortalMembershipService],
})
export class CustomersModule {}
