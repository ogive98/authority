import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationController } from './organization.controller';
import { TenancyGuard } from './tenancy.guard';
import { TenancyService } from './tenancy.service';

@Module({
  imports: [IdentityModule],
  controllers: [OrganizationController],
  providers: [TenancyService, TenancyGuard],
  exports: [TenancyService, TenancyGuard],
})
export class OrganizationModule {}
