import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    MasterDataModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
