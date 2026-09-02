import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DlqService } from '../thunder-core/jobs/dlq/dlq.service';
import { SuperAdminSessionGuard } from './super-admin-session.guard';

@Controller('api/super-admin/v1/thunder')
@UseGuards(SuperAdminSessionGuard)
export class SuperAdminThunderController {
  constructor(private readonly dlqService: DlqService) {}

  @Get('dlq')
  listDlq(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.dlqService.list({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      cursor,
    });
  }
}
