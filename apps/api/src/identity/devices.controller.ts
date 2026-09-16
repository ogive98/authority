import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { IamUser } from '@prisma/client';
import type { Request } from 'express';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import {
  TENANCY_COOKIES,
  TENANCY_HEADERS,
} from '../organization/organization.constants';
import { ClaimDeviceDto } from './device.dto';
import { DeviceService } from './device.service';
import { CurrentUser } from './identity.decorators';
import { IDENTITY_ERROR_CODES } from './identity.constants';
import { IdentityException } from './identity.exception';
import {
  type AuthenticatedRequest,
  SessionGuard,
} from './session.guard';

@Controller('api/v1/identity/devices')
export class DevicesController {
  constructor(private readonly devices: DeviceService) {}

  @Post('pair')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  async pair(
    @CurrentUser() user: IamUser,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertCookieSession(req);
    const companyId = readCompanyId(req);
    if (!companyId) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.FORBIDDEN,
        'Tenancy context required (company_id).',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.devices.pair({
      userId: user.id,
      companyId,
      ip: req.ip,
    });
  }

  @Post('claim')
  @HttpCode(HttpStatus.OK)
  async claim(@Body() dto: ClaimDeviceDto, @Req() req: Request) {
    return this.devices.claim({
      code: dto.code,
      name: dto.name,
      fingerprint: dto.fingerprint,
      ip: req.ip,
    });
  }

  @Get()
  @UseGuards(SessionGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  async list(
    @CurrentUser() user: IamUser,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertCookieSession(req);
    const companyId = readCompanyId(req);
    if (!companyId) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.FORBIDDEN,
        'Tenancy context required (company_id).',
        HttpStatus.FORBIDDEN,
      );
    }
    const items = await this.devices.listForUser(user.id, companyId);
    return { items };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard, PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  async revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: IamUser,
    @Req() req: AuthenticatedRequest,
  ) {
    this.assertCookieSession(req);
    const companyId = readCompanyId(req);
    if (!companyId) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.FORBIDDEN,
        'Tenancy context required (company_id).',
        HttpStatus.FORBIDDEN,
      );
    }
    await this.devices.revoke({
      userId: user.id,
      companyId,
      deviceId: id,
      ip: req.ip,
    });
  }

  private assertCookieSession(req: AuthenticatedRequest): void {
    if (req.authSource !== 'cookie') {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.COOKIE_REQUIRED,
        'Pairing requires a Soft Glass browser session.',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}

function readCompanyId(req: Request): string | undefined {
  const header = req.headers[TENANCY_HEADERS.companyId];
  const fromHeader = typeof header === 'string' ? header : undefined;
  const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
  return fromHeader ?? cookies[TENANCY_COOKIES.companyId];
}
