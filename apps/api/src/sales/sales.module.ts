import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';
import { FinanceModule } from '../finance/finance.module';
import { IdentityModule } from '../identity/identity.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { SalesQuotesController } from './sales-quotes.controller';
import { SalesQuotesService } from './sales-quotes.service';
import { QuotePdfService } from './quote-pdf.service';
import { WaInboxController } from './wa-inbox.controller';
import { WaInboxService } from './wa-inbox.service';
import { ReturnsController } from '../returns/returns.controller';
import { ReturnsService } from '../returns/returns.service';

/** Sales owns orders, quotes, WA inbox, and returns (D317b submodule). */
@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    AuditModule,
    InventoryModule,
    FinanceModule,
    DocumentsModule,
  ],
  controllers: [
    SalesController,
    SalesQuotesController,
    WaInboxController,
    ReturnsController,
  ],
  providers: [
    SalesService,
    SalesQuotesService,
    QuotePdfService,
    WaInboxService,
    ReturnsService,
  ],
  exports: [SalesService, SalesQuotesService, ReturnsService],
})
export class SalesModule {}
