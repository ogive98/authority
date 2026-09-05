import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesModule } from '../sales/sales.module';
import { CustomerPortalAuthService } from './customer-portal-auth.service';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalOrdersService } from './customer-portal-orders.service';
import { CustomerPortalSessionGuard } from './customer-portal-session.guard';

@Module({
  imports: [IdentityModule, PrismaModule, SalesModule],
  controllers: [CustomerPortalController],
  providers: [
    CustomerPortalAuthService,
    CustomerPortalOrdersService,
    CustomerPortalSessionGuard,
  ],
  exports: [CustomerPortalAuthService, CustomerPortalSessionGuard],
})
export class CustomerPortalModule {}
