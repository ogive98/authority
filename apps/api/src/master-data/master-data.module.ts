import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import { IndustryPackService } from './industry-pack.service';

@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
  ],
  controllers: [MasterDataController],
  providers: [MasterDataService, IndustryPackService],
  exports: [MasterDataService, IndustryPackService],
})
export class MasterDataModule {}
