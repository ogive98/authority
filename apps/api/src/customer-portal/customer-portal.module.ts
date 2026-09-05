import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { FinanceModule } from '../finance/finance.module';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SalesModule } from '../sales/sales.module';
import { CustomerPortalAuthService } from './customer-portal-auth.service';
import { CustomerPortalClaimsService } from './customer-portal-claims.service';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalOrdersService } from './customer-portal-orders.service';
import { CustomerPortalSessionGuard } from './customer-portal-session.guard';

@Module({
  imports: [
    IdentityModule,
    PrismaModule,
    SalesModule,
    DeliveryModule,
    FinanceModule,
    AuditModule,
  ],
  controllers: [CustomerPortalController],
  providers: [
    CustomerPortalAuthService,
    CustomerPortalOrdersService,
    CustomerPortalClaimsService,
    CustomerPortalSessionGuard,
  ],
  exports: [CustomerPortalAuthService, CustomerPortalSessionGuard],
})
export class CustomerPortalModule {}
