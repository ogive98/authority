import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ThunderModule } from '../thunder-core/thunder.module';
import { BackupAutoScheduler } from './backup-auto.scheduler';
import { BackupAutoService } from './backup-auto.service';
import { BackupController } from './backup.controller';
import { BackupRetentionScheduler } from './backup-retention.scheduler';
import { BackupRetentionService } from './backup-retention.service';
import { BackupService } from './backup.service';
import { BackupSpecificFoldersScheduler } from './backup-specific-folders.scheduler';
import { BackupSpecificFoldersService } from './backup-specific-folders.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    forwardRef(() => ThunderModule),
  ],
  controllers: [BackupController],
  providers: [
    BackupService,
    BackupRetentionService,
    BackupRetentionScheduler,
    BackupAutoService,
    BackupAutoScheduler,
    BackupSpecificFoldersService,
    BackupSpecificFoldersScheduler,
  ],
  exports: [
    BackupService,
    BackupRetentionService,
    BackupAutoService,
    BackupSpecificFoldersService,
  ],
})
export class BackupModule {}
