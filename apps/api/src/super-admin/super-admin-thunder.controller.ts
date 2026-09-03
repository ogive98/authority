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
import { Observable, from, interval, map, switchMap } from 'rxjs';
import { DlqService } from '../thunder-core/jobs/dlq/dlq.service';
import { MonitorSnapshotService } from '../thunder-core/observability/monitor-snapshot.service';
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
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly monitorSnapshot: MonitorSnapshotService,
    private readonly ruleDefs: RuleDefService,
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
