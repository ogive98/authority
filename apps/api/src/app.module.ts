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
import { SuppliersModule } from './suppliers/suppliers.module';
import { FleetModule } from './fleet/fleet.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { InventoryModule } from './inventory/inventory.module';
import { SalesModule } from './sales/sales.module';
import { DeliveryModule } from './delivery/delivery.module';
import { FinanceModule } from './finance/finance.module';
import { DocumentsModule } from './documents/documents.module';
import { AccountingModule } from './accounting/accounting.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { EmployeePortalModule } from './employee-portal/employee-portal.module';
import { BackupModule } from './backup/backup.module';
import { RepairModule } from './repair/repair.module';
import { ProductionModule } from './production/production.module';
import { TaxModule } from './tax/tax.module';
import { HrModule } from './hr/hr.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AutomationModule } from './automation/automation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ForgeModule } from './forge/forge.module';
import { AnalyticsModule } from './analytics/analytics.module';

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
    SuppliersModule,
    FleetModule,
    MaintenanceModule,
    InventoryModule,
    SalesModule,
    DeliveryModule,
    TaxModule,
    HrModule,
    AttendanceModule,
    FinanceModule,
    DocumentsModule,
    AccountingModule,
    CustomerPortalModule,
    EmployeePortalModule,
    RepairModule,
    BackupModule,
    ProductionModule,
    AutomationModule,
    NotificationsModule,
    ForgeModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
