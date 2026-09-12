import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { IamUser } from '@prisma/client';
import { CurrentUser } from '../identity/identity.decorators';
import { SessionGuard } from '../identity/session.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PermissionGuard } from '../permissions/permission.guard';
import {
  PERMISSION_ERROR_CODES,
  PERMISSION_KEYS,
} from '../permissions/permission.constants';
import { PermissionService } from '../permissions/permission.service';
import {
  CreateAbsenceDto,
  CalendarQueryDto,
  CreateRhEventDto,
  DecideAbsenceDto,
  ListAbsencesQueryDto,
} from './attendance.dto';
import { AttendanceService } from './attendance.service';

@Controller('api/v1/attendance')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly permissions: PermissionService,
  ) {}

  @Get('calendar')
  async calendar(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Query() query: CalendarQueryDto,
  ) {
    await this.assertAny(user.id, tenancy, [
      PERMISSION_KEYS.attendanceManage,
      PERMISSION_KEYS.attendanceApprove,
      PERMISSION_KEYS.attendanceSelf,
      PERMISSION_KEYS.hrEmployeeRead,
    ]);
    return this.attendance.getCalendar(tenancy.companyId, {
      employeeId: query.employeeId,
      from: query.from,
      to: query.to,
    });
  }

  @Post('events')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.attendanceManage)
  createRhEvent(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateRhEventDto,
  ) {
    return this.attendance.createRhEvent(tenancy.companyId, dto, user.id);
  }

  @Get('absences')
  async listAbsences(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Query() query: ListAbsencesQueryDto,
  ) {
    await this.assertAny(user.id, tenancy, [
      PERMISSION_KEYS.attendanceManage,
      PERMISSION_KEYS.attendanceApprove,
      PERMISSION_KEYS.attendanceSelf,
    ]);
    return this.attendance.listAbsences(tenancy.companyId, {
      status: query.status,
      employeeId: query.employeeId,
    });
  }

  @Post('absences')
  @HttpCode(201)
  async createAbsence(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateAbsenceDto,
  ) {
    await this.assertAny(user.id, tenancy, [
      PERMISSION_KEYS.attendanceManage,
      PERMISSION_KEYS.hrEmployeeWrite,
    ]);
    return this.attendance.createAbsence(tenancy.companyId, dto, user.id);
  }

  @Post('absences/:id/approve')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.attendanceApprove)
  approveAbsence(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideAbsenceDto,
  ) {
    return this.attendance.approveAbsence(
      tenancy.companyId,
      id,
      user.id,
      dto.notes,
    );
  }

  @Post('absences/:id/reject')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.attendanceApprove)
  rejectAbsence(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideAbsenceDto,
  ) {
    return this.attendance.rejectAbsence(
      tenancy.companyId,
      id,
      user.id,
      dto.notes,
    );
  }

  @Post('absences/:id/cancel')
  @HttpCode(200)
  async cancelAbsence(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const canManage = await this.permissions.evaluate(
      user.id,
      PERMISSION_KEYS.attendanceManage,
      { companyId: tenancy.companyId, siteId: tenancy.siteId },
    );
    return this.attendance.cancelAbsence(
      tenancy.companyId,
      id,
      user.id,
      canManage,
    );
  }

  private async assertAny(
    userId: string,
    tenancy: TenancyContext,
    keys: Array<(typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS]>,
  ): Promise<void> {
    for (const key of keys) {
      const ok = await this.permissions.evaluate(userId, key, {
        companyId: tenancy.companyId,
        siteId: tenancy.siteId,
      });
      if (ok) return;
    }
    throw new ForbiddenException({
      code: PERMISSION_ERROR_CODES.FORBIDDEN,
      message: 'Permission denied.',
    });
  }
}
