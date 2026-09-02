import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { LicenseModule } from '../license/license.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { OrganizationController } from './organization.controller';
import { TenancyGuard } from './tenancy.guard';
import { TenancyService } from './tenancy.service';

@Module({
  imports: [IdentityModule, LicenseModule, PermissionsModule, AuditModule],
  controllers: [OrganizationController],
  providers: [TenancyService, TenancyGuard],
  exports: [TenancyService, TenancyGuard],
})
export class OrganizationModule {}
