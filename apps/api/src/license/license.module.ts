import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';
import { UserProvisioningService } from './user-provisioning.service';

@Module({
  imports: [IdentityModule, InfrastructureModule, PermissionsModule],
  controllers: [LicenseController],
  providers: [LicenseService, UserProvisioningService],
  exports: [LicenseService, UserProvisioningService],
})
export class LicenseModule {}
