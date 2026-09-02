import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DlqService } from '../thunder-core/jobs/dlq/dlq.service';
import { CircuitBreakerService } from '../thunder-core/resilience/circuit-breaker.service';
import { SuperAdminSessionGuard } from './super-admin-session.guard';

@Controller('api/super-admin/v1/thunder')
@UseGuards(SuperAdminSessionGuard)
export class SuperAdminThunderController {
  constructor(
    private readonly dlqService: DlqService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

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
