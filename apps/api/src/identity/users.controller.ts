import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from './session.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { TenancyGuard } from '../organization/tenancy.guard';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import {
  CreateCompanyUserDto,
  InviteCompanyUserDto,
  SetUserGrantsDto,
  UpdateCompanyUserDto,
} from './users.dto';
import { UsersService } from './users.service';
import { InviteService } from './invite.service';
import { CurrentUser } from './identity.decorators';
import type { IamUser } from '@prisma/client';
import { MailService } from '../mail/mail.service';

@Controller('api/v1/identity/users')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('identity')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly inviteService: InviteService,
    private readonly mail: MailService,
  ) {}

  @Get('roles')
  @RequirePermission(PERMISSION_KEYS.identityUserManage)
  roles() {
    return this.usersService.listRoles();
  }

  @Get('mail-status')
  @RequirePermission(PERMISSION_KEYS.identityUserManage)
  async mailStatus(@CurrentTenancy() tenancy: TenancyContext) {
    const cfg = await this.inviteService.resolveConfig(tenancy.companyId);
    const smtp = this.mail.status(cfg.smtp);
    return {
      ...smtp,
      autoSend: cfg.autoSend,
      ttlDays: cfg.ttlDays,
      minPasswordLength: cfg.minPasswordLength,
      webOrigin: cfg.webOrigin,
    };
  }

  @Post('invite')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.identityUserManage)
  invite(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() actor: IamUser,
    @Body() dto: InviteCompanyUserDto,
  ) {
    return this.inviteService.invite(tenancy.companyId, dto, actor.id);
  }

  @Get()
  @RequirePermission(PERMISSION_KEYS.identityUserManage)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
  ) {
    return this.usersService.list(tenancy.companyId, { q });
  }

  @Get(':id/grants')
  @RequirePermission(PERMISSION_KEYS.identityUserManage)
  getGrants(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.getGrants(tenancy.companyId, id);
  }

  @Put(':id/grants')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.identityUserManage)
  setGrants(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserGrantsDto,
  ) {
    return this.usersService.setGrants(tenancy.companyId, id, dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSION_KEYS.identityUserManage)
  get(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.get(tenancy.companyId, id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.identityUserManage)
  create(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateCompanyUserDto,
  ) {
    return this.usersService.create(tenancy.companyId, dto);
  }

  @Post(':id/reinvite')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.identityUserManage)
  reinvite(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() actor: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inviteService.reinvite(tenancy.companyId, id, actor.id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSION_KEYS.identityUserManage)
  update(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() actor: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyUserDto,
  ) {
    return this.usersService.update(tenancy.companyId, id, dto, actor.id);
  }
}
