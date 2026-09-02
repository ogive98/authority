import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { IamUser } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../identity/identity.decorators';
import { SessionGuard } from '../identity/session.guard';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { JobEnqueueService } from './jobs/job-enqueue.service';
import { JobQueryService } from './jobs/job-query.service';
import { EnqueueHelloJobDto, EnqueueTestJobDto } from './thunder.dto';

@Controller('api/v1/thunder')
@UseGuards(SessionGuard, TenancyGuard, PermissionGuard)
export class ThunderController {
  constructor(
    private readonly jobEnqueueService: JobEnqueueService,
    private readonly jobQueryService: JobQueryService,
  ) {}

  @Post('jobs/hello')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PERMISSION_KEYS.thunderJobEnqueue)
  async enqueueHello(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() body: EnqueueHelloJobDto,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    const result = await this.jobEnqueueService.enqueueHello({
      companyId: tenancy.companyId,
      userId: user.id,
      idempotencyKey: body.idempotencyKey,
      message: body.message,
      correlationId: correlationHeader ?? randomUUID(),
    });

    return result;
  }

  @Post('jobs/fail-retryable')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PERMISSION_KEYS.thunderJobEnqueue)
  async enqueueFailRetryable(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() body: EnqueueTestJobDto,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.jobEnqueueService.enqueueFailRetryable({
      companyId: tenancy.companyId,
      userId: user.id,
      idempotencyKey: body.idempotencyKey,
      correlationId: correlationHeader ?? randomUUID(),
    });
  }

  @Post('jobs/breaker-guarded')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PERMISSION_KEYS.thunderJobEnqueue)
  async enqueueBreakerGuarded(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() body: EnqueueTestJobDto,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.jobEnqueueService.enqueueBreakerGuarded({
      companyId: tenancy.companyId,
      userId: user.id,
      idempotencyKey: body.idempotencyKey,
      correlationId: correlationHeader ?? randomUUID(),
    });
  }

  @Post('jobs/fail-fatal')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission(PERMISSION_KEYS.thunderJobEnqueue)
  async enqueueFailFatal(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() body: EnqueueTestJobDto,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.jobEnqueueService.enqueueFailFatal({
      companyId: tenancy.companyId,
      userId: user.id,
      idempotencyKey: body.idempotencyKey,
      correlationId: correlationHeader ?? randomUUID(),
    });
  }

  @Get('jobs/:id')
  @RequirePermission(PERMISSION_KEYS.thunderJobEnqueue)
  async getJob(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id') jobId: string,
  ) {
    return this.jobQueryService.getJob(jobId, tenancy.companyId);
  }
}
