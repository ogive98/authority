import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../identity/session.guard';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { NotificationsService } from './notifications.service';

/**
 * Soft Glass Centre d’activité (D247) — company inbox.
 * No module gate: available to any ADV session with tenancy + self.read.
 */
@Controller('api/v1/notifications')
@UseGuards(SessionGuard, TenancyGuard, PermissionGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  list(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('unread') unreadRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('source') source?: string,
  ) {
    const unreadOnly =
      unreadRaw === '1' ||
      unreadRaw?.toLowerCase() === 'true' ||
      unreadRaw?.toLowerCase() === 'yes';
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.notifications.list(tenancy.companyId, {
      unreadOnly,
      limit,
      source: source?.trim() || undefined,
    });
  }

  @Post('sync')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  sync(@CurrentTenancy() tenancy: TenancyContext) {
    return this.notifications.sync(tenancy.companyId);
  }

  @Post('read-all')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  markAllRead(@CurrentTenancy() tenancy: TenancyContext) {
    return this.notifications.markAllRead(tenancy.companyId);
  }

  @Post(':id/read')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.identitySelfRead)
  async markRead(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const item = await this.notifications.markRead(tenancy.companyId, id);
    if (!item) throw new NotFoundException('Notification introuvable.');
    return item;
  }
}
