import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';

@Module({
  imports: [IdentityModule, InfrastructureModule],
  controllers: [LicenseController],
  providers: [LicenseService],
  exports: [LicenseService],
})
export class LicenseModule {}
