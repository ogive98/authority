import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { IamUser } from '@prisma/client';
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
import { UpsertExpertiseDto } from './upsert-expertise.dto';

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

  /** D204 — Admin société (settings.company.write) peut écrire ROLE overrides. */
  @Get('capabilities')
  @UseGuards(TenancyGuard)
  async capabilities(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
  ) {
    await this.assertPermission(
      user.id,
      PERMISSION_KEYS.settingsSelf,
      tenancy.companyId,
    );
    const canWriteRole = await this.permissionService.evaluate(
      user.id,
      PERMISSION_KEYS.settingsCompanyWrite,
      { companyId: tenancy.companyId },
    );
    return {
      canWriteRole,
      roles: ['admin', 'accountant', 'operator'],
    };
  }

  /** Legal expertise slots (FODEC / timbre / CNSS…) — Admin company write only (D112). */
  @Get('expertise')
  @UseGuards(TenancyGuard)
  async expertise(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
  ) {
    await this.assertPermission(
      user.id,
      PERMISSION_KEYS.settingsCompanyWrite,
      tenancy.companyId,
    );
    return this.settingsService.listExpertise(tenancy.companyId);
  }

  /** D150/D154 — SMTP test to current admin (Préférences → Envois). */
  @Post('mail-test')
  @HttpCode(200)
  @UseGuards(TenancyGuard)
  async mailTest(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
  ) {
    await this.assertPermission(
      user.id,
      PERMISSION_KEYS.settingsCompanyWrite,
      tenancy.companyId,
    );
    return this.settingsService.sendSmtpTest({
      companyId: tenancy.companyId,
      actorUserId: user.id,
      actorEmail: user.email,
    });
  }

  /** Expert capture — requires lawRef + expertValidatedAt; never invents rates. */
  @Put('expertise/:slotKey')
  @HttpCode(200)
  @UseGuards(TenancyGuard)
  async upsertExpertise(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('slotKey') slotKey: string,
    @Body() dto: UpsertExpertiseDto,
    @Req() req: Request,
  ) {
    await this.assertPermission(
      user.id,
      PERMISSION_KEYS.settingsCompanyWrite,
      tenancy.companyId,
    );

    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];

    return this.settingsService.upsertExpertise(
      tenancy.companyId,
      slotKey,
      dto,
      user.id,
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        correlationId:
          typeof correlation === 'string' ? correlation : undefined,
      },
    );
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
      level === 'COMPANY' || level === 'ROLE'
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
      roleCode: dto.roleCode,
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
