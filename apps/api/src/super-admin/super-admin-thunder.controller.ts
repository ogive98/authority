import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, from, interval, map, switchMap } from 'rxjs';
import { DlqService } from '../thunder-core/jobs/dlq/dlq.service';
import { MonitorSnapshotService } from '../thunder-core/observability/monitor-snapshot.service';
import type { ThunderMonitorSnapshot } from '../thunder-core/observability/monitor-snapshot.types';
import { CircuitBreakerService } from '../thunder-core/resilience/circuit-breaker.service';
import { SuperAdminSessionGuard } from './super-admin-session.guard';

const MONITOR_SSE_MS = 2_000;

@Controller('api/super-admin/v1/thunder')
@UseGuards(SuperAdminSessionGuard)
export class SuperAdminThunderController {
  constructor(
    private readonly dlqService: DlqService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly monitorSnapshot: MonitorSnapshotService,
  ) {}

  @Get('monitor/snapshot')
  getMonitorSnapshot() {
    return this.monitorSnapshot.snapshot();
  }

  @Sse('monitor/stream')
  streamMonitor(): Observable<{ data: ThunderMonitorSnapshot }> {
    return interval(MONITOR_SSE_MS).pipe(
      switchMap(() => from(this.monitorSnapshot.snapshot())),
      map((data) => ({ data })),
    );
  }

  @Get('dlq')
  listDlq(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.dlqService.list({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      cursor,
    });
  }

  @Get('breakers/:dependencyKey')
  getBreaker(@Param('dependencyKey') dependencyKey: string) {
    return this.circuitBreaker.getSnapshot(dependencyKey);
  }

  @Post('breakers/:dependencyKey/open')
  @HttpCode(HttpStatus.OK)
  forceOpenBreaker(@Param('dependencyKey') dependencyKey: string) {
    return this.circuitBreaker.forceOpen(dependencyKey);
  }

  @Post('breakers/:dependencyKey/reset')
  @HttpCode(HttpStatus.OK)
  resetBreaker(@Param('dependencyKey') dependencyKey: string) {
    return this.circuitBreaker.reset(dependencyKey);
  }
}
