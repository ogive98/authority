import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import type { Response } from 'express';
import { Observable, from, interval, map, switchMap } from 'rxjs';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedRequest } from '../identity/session.guard';
import { PrismaService } from '../prisma/prisma.service';
import { DlqService } from '../thunder-core/jobs/dlq/dlq.service';
import { OutboxDlqService } from '../thunder-core/events/outbox-dlq.service';
import { MonitorSnapshotService } from '../thunder-core/observability/monitor-snapshot.service';
import { ThunderMetricsService } from '../thunder-core/observability/thunder-metrics.service';
import type { ThunderMonitorSnapshot } from '../thunder-core/observability/monitor-snapshot.types';
import { CircuitBreakerService } from '../thunder-core/resilience/circuit-breaker.service';
import { RuleDefService } from '../thunder-core/rules/rule-def.service';
import type { RuleAction } from '../thunder-core/rules/rule.types';
import { THUNDER_QUEUE_FAMILIES } from '../thunder-core/thunder.constants';
import { SuperAdminSessionGuard } from './super-admin-session.guard';

const MONITOR_SSE_MS = 2_000;

class RuleActionDto {
  @IsIn(['enqueue_job', 'notify'])
  type!: 'enqueue_job' | 'notify';

  @IsOptional()
  @IsString()
  jobType?: string;

  @IsOptional()
  @IsIn([...THUNDER_QUEUE_FAMILIES])
  queue?: (typeof THUNDER_QUEUE_FAMILIES)[number];

  @IsOptional()
  @IsString()
  emitsEventType?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsIn(['ui', 'email'])
  channel?: 'ui' | 'email';
}

class CreateRuleDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsString()
  moduleKey!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsString()
  eventPattern!: string;

  @IsObject()
  conditions!: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RuleActionDto)
  actions!: RuleActionDto[];
}

class UpdateRuleDto {
  @IsOptional()
  @IsUUID()
  companyId?: string | null;

  @IsOptional()
  @IsString()
  moduleKey?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsString()
  eventPattern?: string;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RuleActionDto)
  actions?: RuleActionDto[];
}

@Controller('api/super-admin/v1/thunder')
@UseGuards(SuperAdminSessionGuard)
export class SuperAdminThunderController {
  constructor(
    private readonly dlqService: DlqService,
    private readonly outboxDlqService: OutboxDlqService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly monitorSnapshot: MonitorSnapshotService,
    private readonly ruleDefs: RuleDefService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly metrics: ThunderMetricsService,
  ) {}

  @Get('monitor/snapshot')
  getMonitorSnapshot() {
    return this.monitorSnapshot.snapshot();
  }

  @Get('metrics')
  async getPrometheusMetrics(@Res() res: Response): Promise<void> {
    await this.monitorSnapshot.snapshot();
    const body = await this.metrics.metricsText();
    res.setHeader('Content-Type', this.metrics.contentType);
    res.status(HttpStatus.OK).send(body);
  }

  @Sse('monitor/stream')
  streamMonitor(): Observable<{ data: ThunderMonitorSnapshot }> {
    return interval(MONITOR_SSE_MS).pipe(
      switchMap(() => from(this.monitorSnapshot.snapshot())),
      map((data) => ({ data })),
    );
  }

  @Get('rules')
  listRules(@Query('companyId') companyId?: string) {
    return this.ruleDefs.list(companyId ? { companyId } : undefined);
  }

  @Get('rules/:id')
  getRule(@Param('id') id: string) {
    return this.ruleDefs.get(id);
  }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  createRule(@Body() body: CreateRuleDto) {
    return this.ruleDefs.create({
      companyId: body.companyId ?? null,
      moduleKey: body.moduleKey,
      name: body.name,
      enabled: body.enabled ?? true,
      priority: body.priority ?? 100,
      eventPattern: body.eventPattern,
      conditions: body.conditions,
      actions: body.actions.map(mapRuleActionDto),
    });
  }

  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body() body: UpdateRuleDto) {
    return this.ruleDefs.update(id, {
      companyId: body.companyId,
      moduleKey: body.moduleKey,
      name: body.name,
      enabled: body.enabled,
      priority: body.priority,
      eventPattern: body.eventPattern,
      conditions: body.conditions,
      actions: body.actions?.map(mapRuleActionDto),
    });
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(@Param('id') id: string): Promise<void> {
    await this.ruleDefs.remove(id);
  }

  @Get('dlq')
  listDlq(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.dlqService.list({
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      cursor,
    });
  }

  @Get('outbox-dlq')
  listOutboxDlq(
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.outboxDlqService.list({
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
  async forceOpenBreaker(
    @Req() req: AuthenticatedRequest & Request,
    @Param('dependencyKey') dependencyKey: string,
  ) {
    const before = await this.circuitBreaker.getSnapshot(dependencyKey);
    const after = await this.circuitBreaker.forceOpen(dependencyKey);
    await this.prisma.$transaction(async (tx) => {
      await this.audit.append(tx, {
        actorUserId: req.user!.id,
        action: AUDIT_ACTIONS.thunderBreakerForceOpen,
        entityType: AUDIT_ENTITY_TYPES.thunderCircuitBreaker,
        entityId: dependencyKey,
        beforeJson: {
          state: before.state,
          failures: before.failures,
          openedAt: before.openedAt,
        },
        afterJson: {
          state: after.state,
          failures: after.failures,
          openedAt: after.openedAt,
        },
        ip: req.ip,
        device: req.headers['user-agent'],
      });
    });
    return after;
  }

  @Post('breakers/:dependencyKey/reset')
  @HttpCode(HttpStatus.OK)
  async resetBreaker(
    @Req() req: AuthenticatedRequest & Request,
    @Param('dependencyKey') dependencyKey: string,
  ) {
    const before = await this.circuitBreaker.getSnapshot(dependencyKey);
    const after = await this.circuitBreaker.reset(dependencyKey);
    await this.prisma.$transaction(async (tx) => {
      await this.audit.append(tx, {
        actorUserId: req.user!.id,
        action: AUDIT_ACTIONS.thunderBreakerReset,
        entityType: AUDIT_ENTITY_TYPES.thunderCircuitBreaker,
        entityId: dependencyKey,
        beforeJson: {
          state: before.state,
          failures: before.failures,
          openedAt: before.openedAt,
        },
        afterJson: {
          state: after.state,
          failures: after.failures,
          openedAt: after.openedAt,
        },
        ip: req.ip,
        device: req.headers['user-agent'],
      });
    });
    return after;
  }
}

function mapRuleActionDto(action: RuleActionDto): RuleAction {
  if (action.type === 'notify') {
    return {
      type: 'notify',
      templateId: action.templateId ?? '',
      channel: action.channel ?? 'ui',
    };
  }
  return {
    type: 'enqueue_job',
    jobType: action.jobType ?? '',
    queue: action.queue ?? 'ops',
    emitsEventType: action.emitsEventType,
  };
}
