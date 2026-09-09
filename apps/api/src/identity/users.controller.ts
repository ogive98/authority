import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CreateCompanyUserDto, UpdateCompanyUserDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('api/v1/identity/users')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('identity')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('roles')
  @RequirePermission(PERMISSION_KEYS.identityUserManage)
  roles() {
    return this.usersService.listRoles();
  }

  @Get()
  @RequirePermission(PERMISSION_KEYS.identityUserManage)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
  ) {
    return this.usersService.list(tenancy.companyId, { q });
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

  @Patch(':id')
  @RequirePermission(PERMISSION_KEYS.identityUserManage)
  update(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyUserDto,
  ) {
    return this.usersService.update(tenancy.companyId, id, dto);
  }
}
