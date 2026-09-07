import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../identity/session.guard';
import { SuperAdminSessionGuard } from '../super-admin/super-admin-session.guard';
import {
  ExecuteDto,
  HealthScanDto,
  PlanDto,
  ResetScopeDto,
  RollbackDto,
  SnapshotDto,
  VerifyDto,
} from './repair.dto';
import { RepairFacade } from './repair.facade';

/** Legacy Control Console surface — product path is `/api/v1/repair` (ERP). */
@Controller('api/super-admin/v1/repair')
@UseGuards(SuperAdminSessionGuard)
export class RepairController {
  constructor(private readonly facade: RepairFacade) {}

  @Get('dashboard')
  dashboard(@Query('companyId') companyId?: string) {
    return this.facade.dashboard(companyId);
  }

  @Get('health')
  health() {
    return this.facade.health();
  }

  @Post('health/scan')
  @HttpCode(HttpStatus.OK)
  scan(@Body() body: HealthScanDto, @Req() req: AuthenticatedRequest & Request) {
    return this.facade.runScan({
      depth: body.depth,
      domains: body.domains ?? [],
      companyId: body.companyId,
      createdBy: req.user?.id,
    });
  }

  @Get('diagnostics/findings')
  async findings(@Query('companyId') companyId?: string) {
    const items = await this.facade.listFindings({ companyId });
    return { items };
  }

  @Get('diagnostics/incidents')
  async incidents(@Query('companyId') companyId?: string) {
    const items = await this.facade.listIncidents({ companyId });
    return { items };
  }

  @Get('repair/issues')
  async issues(@Query('companyId') companyId?: string) {
    const items = await this.facade.listIssues({ companyId });
    return { items };
  }

  @Post('repair/plan')
  @HttpCode(HttpStatus.OK)
  async plan(
    @Body() body: PlanDto,
    @Req() req: AuthenticatedRequest & Request,
  ) {
    const execution = await this.facade.plan({
      findingId: body.findingId,
      scenarioId: body.scenarioId,
      companyId: body.companyId,
      actorId: req.user?.id,
    });
    return { execution };
  }

  @Post('repair/execute')
  @HttpCode(HttpStatus.OK)
  async execute(
    @Body() body: ExecuteDto,
    @Req() req: AuthenticatedRequest & Request,
  ) {
    const execution = await this.facade.execute({
      executionId: body.executionId,
      confirm: body.confirm,
      dryRun: body.dryRun,
      actorId: req.user?.id,
    });
    return { execution };
  }

  @Post('repair/rollback')
  @HttpCode(HttpStatus.OK)
  rollback(
    @Body() body: RollbackDto,
    @Req() req: AuthenticatedRequest & Request,
  ) {
    return this.facade.rollback(body.executionId, req.user?.id);
  }

  @Get('reset/scopes')
  resetScopes() {
    return { scopes: this.facade.listResetScopes() };
  }

  @Post('reset/preview')
  @HttpCode(HttpStatus.OK)
  async resetPreview(
    @Body() body: ResetScopeDto,
    @Req() req: AuthenticatedRequest & Request,
  ) {
    const preview = await this.facade.resetPreview({
      scope: body.scope,
      companyId: body.companyId,
      createdBy: req.user?.id,
    });
    return { preview };
  }

  @Post('reset/execute')
  @HttpCode(HttpStatus.OK)
  resetExecute(
    @Body() body: ResetScopeDto,
    @Req() req: AuthenticatedRequest & Request,
  ) {
    return this.facade.resetExecute({
      scope: body.scope,
      companyId: body.companyId,
      createdBy: req.user?.id,
      confirm: body.confirm,
    });
  }

  @Post('snapshots')
  @HttpCode(HttpStatus.OK)
  async createSnapshot(@Body() body: SnapshotDto) {
    const snap = await this.facade.createSnapshot({
      companyId: body.companyId,
      label: body.label,
    });
    return {
      id: snap.ref,
      ref: snap.ref,
      label: snap.label,
      createdAt: snap.createdAt,
    };
  }

  @Get('backups')
  backups() {
    const items = this.facade.listBackups().map((b) => ({
      id: b.ref,
      ref: b.ref,
      label: b.label,
      createdAt: b.createdAt,
    }));
    return { items };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() body: VerifyDto) {
    const detail = await this.facade.verify(body.executionId);
    return { ok: true, detail };
  }

  @Get('audit')
  async audit(@Query('companyId') companyId?: string) {
    const items = await this.facade.listAudit({ companyId });
    return { items };
  }

  @Get('maintenance')
  maintenance() {
    return this.facade.maintenance();
  }

  @Get('reporting/status')
  reportingStatus() {
    return this.facade.reportingStatus();
  }

  @Post('reporting/flush')
  @HttpCode(HttpStatus.OK)
  async reportingFlush() {
    return this.facade.reportingFlush();
  }
}
