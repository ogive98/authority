import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IdentityModule } from '../identity/identity.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { FileService } from './file.service';
import { MinioService } from './minio.service';
import { NumberingService } from './numbering.service';
import { PlatformController } from './platform.controller';

@Module({
  imports: [
    IdentityModule,
    OrganizationModule,
    PermissionsModule,
    ModulesRegistryModule,
    AuditModule,
  ],
  controllers: [PlatformController],
  providers: [NumberingService, FileService, MinioService],
  exports: [NumberingService, FileService, MinioService],
})
export class PlatformModule {}
