import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { IamUser } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { Observable, from, interval, map, switchMap } from 'rxjs';
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
import { MonitorSnapshotService } from './observability/monitor-snapshot.service';
import { ThunderMetricsService } from './observability/thunder-metrics.service';
import type { ThunderMonitorSnapshot } from './observability/monitor-snapshot.types';
import { EnqueueHelloJobDto, EnqueueTestJobDto } from './thunder.dto';
import { ThunderDevOnlyGuard } from './thunder-dev-only.guard';

const MONITOR_SSE_MS = 2_000;

@Controller('api/v1/thunder')
@UseGuards(SessionGuard, TenancyGuard, PermissionGuard)
export class ThunderController {
  constructor(
    private readonly jobEnqueueService: JobEnqueueService,
    private readonly jobQueryService: JobQueryService,
    private readonly monitorSnapshot: MonitorSnapshotService,
    private readonly metrics: ThunderMetricsService,
  ) {}

  @Get('monitor/snapshot')
  @RequirePermission(PERMISSION_KEYS.systemMonitoringView)
  getMonitorSnapshot() {
    return this.monitorSnapshot.snapshot();
  }

  @Get('metrics')
  @RequirePermission(PERMISSION_KEYS.systemMonitoringView)
  async getPrometheusMetrics(@Res() res: Response): Promise<void> {
    // Refresh gauges from live snapshot before scrape.
    await this.monitorSnapshot.snapshot();
    const body = await this.metrics.metricsText();
    res.setHeader('Content-Type', this.metrics.contentType);
    res.status(HttpStatus.OK).send(body);
  }

  @Sse('monitor/stream')
  @RequirePermission(PERMISSION_KEYS.systemMonitoringView)
  streamMonitor(): Observable<{ data: ThunderMonitorSnapshot }> {
    return interval(MONITOR_SSE_MS).pipe(
      switchMap(() => from(this.monitorSnapshot.snapshot())),
      map((data) => ({ data })),
    );
  }

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
  @UseGuards(ThunderDevOnlyGuard)
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
  @UseGuards(ThunderDevOnlyGuard)
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

  @Post('jobs/fail-timeout')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ThunderDevOnlyGuard)
  @RequirePermission(PERMISSION_KEYS.thunderJobEnqueue)
  async enqueueFailTimeout(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() body: EnqueueTestJobDto,
    @Headers('x-correlation-id') correlationHeader?: string,
  ) {
    return this.jobEnqueueService.enqueueFailTimeout({
      companyId: tenancy.companyId,
      userId: user.id,
      idempotencyKey: body.idempotencyKey,
      correlationId: correlationHeader ?? randomUUID(),
    });
  }

  @Post('jobs/fail-fatal')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ThunderDevOnlyGuard)
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
