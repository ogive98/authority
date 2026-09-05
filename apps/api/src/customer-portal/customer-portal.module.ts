import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerPortalAuthService } from './customer-portal-auth.service';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalSessionGuard } from './customer-portal-session.guard';

@Module({
  imports: [IdentityModule, PrismaModule],
  controllers: [CustomerPortalController],
  providers: [CustomerPortalAuthService, CustomerPortalSessionGuard],
  exports: [CustomerPortalAuthService, CustomerPortalSessionGuard],
})
export class CustomerPortalModule {}
