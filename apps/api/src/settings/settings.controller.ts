import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../identity/identity.decorators';
import { SessionGuard } from '../identity/session.guard';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import {
  PERMISSION_ERROR_CODES,
  PERMISSION_KEYS,
} from '../permissions/permission.constants';
import { PermissionService } from '../permissions/permission.service';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './update-setting.dto';

@Controller('api/v1/settings')
@UseGuards(SessionGuard, ModuleGuard)
@RequireModule('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly permissionService: PermissionService,
  ) {}

  @Get('effective')
  @UseGuards(TenancyGuard)
  async effective(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
  ) {
    await this.assertPermission(
      user.id,
      PERMISSION_KEYS.settingsSelf,
      tenancy.companyId,
    );

    const roleCode = await this.settingsService.resolveRoleCode(
      user.id,
      tenancy.companyId,
    );

    return this.settingsService.getEffective({
      userId: user.id,
      companyId: tenancy.companyId,
      roleCode,
    });
  }

  @Put()
  @HttpCode(200)
  @UseGuards(TenancyGuard)
  async update(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: UpdateSettingDto,
    @Req() req: Request,
  ) {
    const level = dto.level ?? 'USER';
    const permissionKey =
      level === 'COMPANY'
        ? PERMISSION_KEYS.settingsCompanyWrite
        : PERMISSION_KEYS.settingsSelf;

    await this.assertPermission(user.id, permissionKey, tenancy.companyId);

    const roleCode = await this.settingsService.resolveRoleCode(
      user.id,
      tenancy.companyId,
    );

    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];

    return this.settingsService.upsertValue({
      context: {
        userId: user.id,
        companyId: tenancy.companyId,
        roleCode,
      },
      key: dto.key,
      value: dto.value,
      level,
      actorUserId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  private async assertPermission(
    userId: string,
    permissionKey: (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS],
    companyId: string,
  ): Promise<void> {
    const allowed = await this.permissionService.evaluate(
      userId,
      permissionKey,
      {
        companyId,
      },
    );

    if (!allowed) {
      throw new ForbiddenException({
        code: PERMISSION_ERROR_CODES.FORBIDDEN,
        message: 'Permission denied.',
      });
    }
  }
}
