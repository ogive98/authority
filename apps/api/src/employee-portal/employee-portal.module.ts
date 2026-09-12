import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { HrModule } from '../hr/hr.module';
import { IdentityModule } from '../identity/identity.module';
import { ModulesRegistryModule } from '../modules-registry/modules-registry.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmployeePortalAuthService } from './employee-portal-auth.service';
import { EmployeePortalController } from './employee-portal.controller';
import { EmployeePortalModuleGuard } from './employee-portal-module.guard';
import { EmployeePortalSessionGuard } from './employee-portal-session.guard';

@Module({
  imports: [
    IdentityModule,
    PrismaModule,
    ModulesRegistryModule,
    AttendanceModule,
    HrModule,
  ],
  controllers: [EmployeePortalController],
  providers: [
    EmployeePortalAuthService,
    EmployeePortalSessionGuard,
    EmployeePortalModuleGuard,
  ],
  exports: [EmployeePortalAuthService, EmployeePortalSessionGuard],
})
export class EmployeePortalModule {}
