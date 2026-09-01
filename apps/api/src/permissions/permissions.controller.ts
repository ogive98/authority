import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../identity/identity.decorators';
import { SessionGuard } from '../identity/session.guard';
import { CheckPermissionDto } from './check-permission.dto';
import { PERMISSION_CATALOGUE } from './permission.constants';
import { PermissionService } from './permission.service';

@Controller('api/v1/identity/permissions')
@UseGuards(SessionGuard)
export class PermissionsController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get('catalog')
  catalog() {
    return { permissions: [...PERMISSION_CATALOGUE] };
  }

  @Post('check')
  @HttpCode(200)
  async check(
    @CurrentUser() user: { id: string },
    @Body() dto: CheckPermissionDto,
  ) {
    const allowed = await this.permissionService.evaluate(
      user.id,
      dto.permissionKey,
      {
        companyId: dto.companyId,
        siteId: dto.siteId,
        warehouseId: dto.warehouseId,
      },
    );

    return {
      permissionKey: dto.permissionKey,
      allowed,
    };
  }
}
