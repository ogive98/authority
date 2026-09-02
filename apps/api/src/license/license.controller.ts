import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../identity/session.guard';
import {
  TENANCY_COOKIES,
  TENANCY_HEADERS,
} from '../organization/organization.constants';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { ActivateLicenseDto } from './activate-license.dto';
import { LicenseService } from './license.service';

@Controller('api/v1/license')
@UseGuards(SessionGuard)
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get('status')
  status(@Req() req: Request) {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const companyHeader = req.headers[TENANCY_HEADERS.companyId];
    const companyId =
      (typeof companyHeader === 'string' ? companyHeader : undefined) ??
      cookies[TENANCY_COOKIES.companyId];

    return this.licenseService.getStatus(companyId);
  }

  @Post('activate')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.licenseManage)
  activate(@Body() dto: ActivateLicenseDto) {
    return this.licenseService.activate(dto.payload, dto.signature);
  }
}
