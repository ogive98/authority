import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../identity/session.guard';
import { SessionGuard } from '../identity/session.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PermissionGuard } from '../permissions/permission.guard';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
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

/**
 * ERP métier Repair — Utility Cube module (D080).
 * Control Center SA routes stay separate; this is the product surface.
 */
@Controller('api/v1/repair')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('repair')
export class RepairErpController {
  constructor(private readonly facade: RepairFacade) {}

  @Get('dashboard')
  @RequirePermission(PERMISSION_KEYS.repairRead)
  dashboard(@CurrentTenancy() tenancy: TenancyContext) {
    return this.facade.dashboard(tenancy.companyId);
  }

  @Get('coverage')
  @RequirePermission(PERMISSION_KEYS.repairRead)
  coverage() {
    return this.facade.coverage();
  }

  @Get('health')
  @RequirePermission(PERMISSION_KEYS.repairRead)
  health() {
    return this.facade.health();
  }

  @Post('health/scan')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.repairScan)
  scan(
    @Body() body: HealthScanDto,
    @CurrentTenancy() tenancy: TenancyContext,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.facade.runScan({
      depth: body.depth,
      domains: body.domains ?? [],
      companyId: tenancy.companyId,
      createdBy: req.user?.id,
    });
  }

  @Get('diagnostics/findings')
  @RequirePermission(PERMISSION_KEYS.repairRead)
  async findings(@CurrentTenancy() tenancy: TenancyContext) {
    const items = await this.facade.listFindings({
      companyId: tenancy.companyId,
    });
    return { items };
  }

  @Get('diagnostics/incidents')
  @RequirePermission(PERMISSION_KEYS.repairRead)
  async incidents(@CurrentTenancy() tenancy: TenancyContext) {
    const items = await this.facade.listIncidents({
      companyId: tenancy.companyId,
    });
    return { items };
  }

  @Get('repair/issues')
  @RequirePermission(PERMISSION_KEYS.repairRead)
  async issues(@CurrentTenancy() tenancy: TenancyContext) {
    const items = await this.facade.listIssues({
      companyId: tenancy.companyId,
    });
    return { items };
  }

  @Post('repair/plan')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.repairScan)
  async plan(
    @Body() body: PlanDto,
    @CurrentTenancy() tenancy: TenancyContext,
    @Req() req: AuthenticatedRequest,
  ) {
    const execution = await this.facade.plan({
      findingId: body.findingId,
      scenarioId: body.scenarioId,
      companyId: tenancy.companyId,
      actorId: req.user?.id,
    });
    return { execution };
  }

  @Post('repair/execute')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.repairExecute)
  async execute(
    @Body() body: ExecuteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const execution = await this.facade.execute({
      executionId: body.executionId,
      confirm: body.confirm,
      dryRun: body.dryRun,
      actorId: req.user?.id,
      password: body.password,
    });
    return { execution };
  }

  @Post('repair/rollback')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.repairExecute)
  rollback(
    @Body() body: RollbackDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.facade.rollback(body.executionId, req.user?.id);
  }

  @Get('reset/scopes')
  @RequirePermission(PERMISSION_KEYS.repairRead)
  resetScopes() {
    return { scopes: this.facade.listResetScopes() };
  }

  @Post('reset/preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.repairReset)
  async resetPreview(
    @Body() body: ResetScopeDto,
    @CurrentTenancy() tenancy: TenancyContext,
    @Req() req: AuthenticatedRequest,
  ) {
    const preview = await this.facade.resetPreview({
      scope: body.scope,
      companyId: tenancy.companyId,
      createdBy: req.user?.id,
    });
    return { preview };
  }

  @Post('reset/execute')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.repairReset)
  resetExecute(
    @Body() body: ResetScopeDto,
    @CurrentTenancy() tenancy: TenancyContext,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.facade.resetExecute({
      scope: body.scope,
      companyId: tenancy.companyId,
      createdBy: req.user?.id,
      confirm: body.confirm,
      password: body.password,
      confirmPhrase: body.confirmPhrase,
    });
  }

  @Post('snapshots')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.repairScan)
  async createSnapshot(
    @Body() body: SnapshotDto,
    @CurrentTenancy() tenancy: TenancyContext,
  ) {
    const snap = await this.facade.createSnapshot({
      companyId: tenancy.companyId,
      label: body.label,
    });
    return {
      id: snap.ref,
      ref: snap.ref,
      kind: snap.kind,
      restorable: snap.restorable,
      label: snap.label,
      createdAt: snap.createdAt,
      note: snap.note,
    };
  }

  @Get('backups')
  @RequirePermission(PERMISSION_KEYS.repairRead)
  backups() {
    const items = this.facade.listBackups().map((b) => ({
      id: b.ref,
      ref: b.ref,
      kind: b.kind,
      restorable: b.restorable,
      label: b.label,
      createdAt: b.createdAt,
      note: b.note,
    }));
    return { items };
  }

  @Get('recovery/policies')
  @RequirePermission(PERMISSION_KEYS.repairRead)
  recoveryPolicies() {
    return { policies: this.facade.recoveryPolicies() };
  }

  @Post('recovery/manifest')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.repairScan)
  async recoveryManifest(
    @Body() body: SnapshotDto,
    @CurrentTenancy() tenancy: TenancyContext,
  ) {
    const manifest = await this.facade.createRecoveryManifest({
      companyId: tenancy.companyId,
      label: body.label,
    });
    return { manifest };
  }

  @Post('snapshots/:ref/restore')
  @HttpCode(HttpStatus.FORBIDDEN)
  @RequirePermission(PERMISSION_KEYS.repairExecute)
  restoreSnapshot(@Param('ref') ref: string) {
    return this.facade.restoreSnapshot(ref);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.repairScan)
  async verify(@Body() body: VerifyDto) {
    const detail = await this.facade.verify(body.executionId);
    return { ok: true, detail };
  }

  @Get('audit')
  @RequirePermission(PERMISSION_KEYS.repairRead)
  async audit(@CurrentTenancy() tenancy: TenancyContext) {
    const items = await this.facade.listAudit({
      companyId: tenancy.companyId,
    });
    return { items };
  }

  @Get('maintenance')
  @RequirePermission(PERMISSION_KEYS.repairRead)
  maintenance() {
    return this.facade.maintenance();
  }

  @Get('reporting/status')
  @RequirePermission(PERMISSION_KEYS.repairRead)
  reportingStatus() {
    return this.facade.reportingStatus();
  }

  @Post('reporting/flush')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.repairRead)
  async reportingFlush() {
    return this.facade.reportingFlush();
  }
}
