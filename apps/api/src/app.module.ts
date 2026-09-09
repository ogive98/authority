import './load-env';
import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { UsersModule } from './identity/users.module';
import { OrganizationModule } from './organization/organization.module';
import { PrismaModule } from './prisma/prisma.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { ModulesRegistryModule } from './modules-registry/modules-registry.module';
import { AuditModule } from './audit/audit.module';
import { PlatformModule } from './platform/platform.module';
import { LicenseModule } from './license/license.module';
import { SettingsModule } from './settings/settings.module';
import { ThunderModule } from './thunder-core/thunder.module';
import { ProductsModule } from './products/products.module';
import { MasterDataModule } from './master-data/master-data.module';
import { CustomersModule } from './customers/customers.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { DeliveryModule } from './delivery/delivery.module';
import { FinanceModule } from './finance/finance.module';
import { DocumentsModule } from './documents/documents.module';
import { AccountingModule } from './accounting/accounting.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { RepairModule } from './repair/repair.module';
import { ProductionModule } from './production/production.module';
import { TaxModule } from './tax/tax.module';
import { HrModule } from './hr/hr.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuditModule,
    IdentityModule,
    UsersModule,
    OrganizationModule,
    SuperAdminModule,
    ModulesRegistryModule,
    PlatformModule,
    LicenseModule,
    SettingsModule,
    ThunderModule,
    MasterDataModule,
    ProductsModule,
    CustomersModule,
    InventoryModule,
    SalesModule,
    DeliveryModule,
    TaxModule,
    HrModule,
    FinanceModule,
    DocumentsModule,
    AccountingModule,
    CustomerPortalModule,
    RepairModule,
    ProductionModule,
  ],
})
export class AppModule {}
