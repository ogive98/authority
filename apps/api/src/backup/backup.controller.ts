import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../identity/identity.decorators';
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
  ApproveRestoreDto,
  ApplyRestoreDto,
  BackupMkdirDto,
  CreateBackupDto,
  RequestRestoreDto,
  SpecificFoldersJobDto,
  SpecificFoldersPreviewDto,
  SpecificFoldersValidateDto,
} from './backup.dto';
import { BackupRetentionService } from './backup-retention.service';
import { BackupSpecificFoldersService } from './backup-specific-folders.service';
import { BackupService } from './backup.service';

@Controller('api/v1/backup')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('backup')
export class BackupController {
  constructor(
    private readonly backup: BackupService,
    private readonly retention: BackupRetentionService,
    private readonly specificFolders: BackupSpecificFoldersService,
  ) {}

  @Get('dashboard')
  @RequirePermission(PERMISSION_KEYS.backupView)
  dashboard(@CurrentTenancy() tenancy: TenancyContext) {
    return this.backup.dashboard(tenancy.companyId);
  }

  @Get('backups')
  @RequirePermission(PERMISSION_KEYS.backupView)
  list(@CurrentTenancy() tenancy: TenancyContext) {
    return this.backup.listBackups(tenancy.companyId);
  }

  @Post('backups')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupCreate)
  create(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateBackupDto,
    @Req() req: Request,
  ) {
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];
    return this.backup.createBackup({
      companyId: tenancy.companyId,
      actorUserId: user.id,
      label: dto.label,
      scope: dto.scope,
      siteId: tenancy.siteId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  @Get('backups/:id')
  @RequirePermission(PERMISSION_KEYS.backupView)
  get(@CurrentTenancy() tenancy: TenancyContext, @Param('id') id: string) {
    return this.backup.getBackup(tenancy.companyId, id);
  }

  @Post('backups/:id/verify')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupVerify)
  verify(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];
    return this.backup.verify({
      companyId: tenancy.companyId,
      backupId: id,
      actorUserId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  @Post('backups/:id/lock')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupManageSettings)
  lock(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];
    return this.backup.lock({
      companyId: tenancy.companyId,
      backupId: id,
      actorUserId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  @Post('backups/:id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupRestore)
  requestRestore(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id') id: string,
    @Body() dto: RequestRestoreDto,
    @Req() req: Request,
  ) {
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];
    return this.backup.requestRestore({
      companyId: tenancy.companyId,
      backupId: id,
      actorUserId: user.id,
      password: dto.password,
      confirm: dto.confirm,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  @Post('restore-requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupRestore)
  approveRestore(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id') id: string,
    @Body() dto: ApproveRestoreDto,
    @Req() req: Request,
  ) {
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];
    return this.backup.approveRestore({
      companyId: tenancy.companyId,
      restoreRequestId: id,
      actorUserId: user.id,
      password: dto.password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  @Post('restore-requests/:id/apply')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupRestore)
  applyRestore(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id') id: string,
    @Body() dto: ApplyRestoreDto,
    @Req() req: Request,
  ) {
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];
    return this.backup.applyRestore({
      companyId: tenancy.companyId,
      restoreRequestId: id,
      actorUserId: user.id,
      password: dto.password,
      confirmPhrase: dto.confirmPhrase,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  @Get('restore-requests')
  @RequirePermission(PERMISSION_KEYS.backupView)
  restoreRequests(@CurrentTenancy() tenancy: TenancyContext) {
    return this.backup.listRestoreRequests(tenancy.companyId);
  }

  @Delete('backups/:id')
  @RequirePermission(PERMISSION_KEYS.backupManageSettings)
  remove(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];
    return this.backup.softDelete({
      companyId: tenancy.companyId,
      backupId: id,
      actorUserId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  @Get('jobs')
  @RequirePermission(PERMISSION_KEYS.backupView)
  jobs(@CurrentTenancy() tenancy: TenancyContext) {
    return this.backup.listJobs(tenancy.companyId);
  }

  @Get('destinations')
  @RequirePermission(PERMISSION_KEYS.backupView)
  destinations(@CurrentTenancy() tenancy: TenancyContext) {
    return this.backup.listDestinations(tenancy.companyId);
  }

  @Post('destinations/:id/test')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupManageSettings)
  testDestination(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];
    return this.backup.testDestination({
      companyId: tenancy.companyId,
      destinationId: id,
      actorUserId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  // —— D314 company files + LOCAL_DISK path ——

  @Get('company-files')
  @RequirePermission(PERMISSION_KEYS.backupSpecificFolderView)
  listCompanyFiles(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('path') path?: string,
  ) {
    return this.backup.listCompanyFiles(tenancy.companyId, path ?? '');
  }

  @Post('company-files/mkdir')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupSpecificFolderCreate)
  mkdirCompanyFiles(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: BackupMkdirDto,
  ) {
    return this.backup.mkdirCompanyFiles(tenancy.companyId, {
      path: dto.path,
      name: dto.name,
    });
  }

  @Get('destinations/local/resolve')
  @RequirePermission(PERMISSION_KEYS.backupDestinationLocalDisk)
  resolveLocalDisk(@CurrentTenancy() tenancy: TenancyContext) {
    return this.backup.resolveLocalDisk(tenancy.companyId);
  }

  @Post('destinations/local/mkdir')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupDestinationLocalDisk)
  mkdirLocalDisk(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: BackupMkdirDto,
  ) {
    return this.backup.mkdirLocalDisk(tenancy.companyId, {
      path: dto.path,
      name: dto.name,
    });
  }

  @Get('policies')
  @RequirePermission(PERMISSION_KEYS.backupView)
  policies(@CurrentTenancy() tenancy: TenancyContext) {
    return this.backup.listPolicies(tenancy.companyId);
  }

  @Get('settings/effective')
  @RequirePermission(PERMISSION_KEYS.backupView)
  effectiveSettings(@CurrentTenancy() tenancy: TenancyContext) {
    return this.backup.effectiveSettings(tenancy.companyId);
  }

  @Post('restore-requests/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupRestore)
  cancelRestore(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];
    return this.backup.cancelRestore({
      companyId: tenancy.companyId,
      restoreRequestId: id,
      actorUserId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  @Post('retention/run')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupManageSettings)
  runRetention(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Req() req: Request,
  ) {
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];
    return this.retention.runRetention(tenancy.companyId, {
      force: true,
      actorUserId: user.id,
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  // —— D313 Specific folders ——

  @Get('specific-folders/config')
  @RequirePermission(PERMISSION_KEYS.backupSpecificFolderView)
  specificFoldersConfig(@CurrentTenancy() tenancy: TenancyContext) {
    return this.specificFolders.getConfig(tenancy.companyId);
  }

  @Get('specific-folders/roots')
  @RequirePermission(PERMISSION_KEYS.backupSpecificFolderView)
  specificFoldersRoots(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('parent') parent?: string,
  ) {
    return this.specificFolders.listRoots(tenancy.companyId, parent ?? '');
  }

  @Post('specific-folders/validate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupSpecificFolderCreate)
  specificFoldersValidate(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: SpecificFoldersValidateDto,
  ) {
    return this.specificFolders.validateFolders(
      tenancy.companyId,
      dto.folders,
    );
  }

  @Post('specific-folders/preview')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupSpecificFolderCreate)
  specificFoldersPreview(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: SpecificFoldersPreviewDto,
  ) {
    return this.specificFolders.preview({
      companyId: tenancy.companyId,
      folders: dto.folders,
      includePatterns: dto.includePatterns,
      excludePatterns: dto.excludePatterns,
    });
  }

  @Post('specific-folders/jobs')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupSpecificFolderCreate)
  specificFoldersJobs(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: SpecificFoldersJobDto,
    @Req() req: Request,
  ) {
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];
    return this.specificFolders.enqueueJob({
      companyId: tenancy.companyId,
      actorUserId: user.id,
      label: dto.label,
      folders: dto.folders,
      destinationMode: dto.destinationMode,
      includePatterns: dto.includePatterns,
      excludePatterns: dto.excludePatterns,
      verifyAfterBackup: dto.verifyAfterBackup,
      siteId: tenancy.siteId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  @Get('jobs/:id')
  @RequirePermission(PERMISSION_KEYS.backupSpecificFolderView)
  getJob(@CurrentTenancy() tenancy: TenancyContext, @Param('id') id: string) {
    return this.specificFolders.getJob(tenancy.companyId, id);
  }

  @Post('jobs/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(PERMISSION_KEYS.backupSpecificFolderCreate)
  cancelJob(
    @CurrentUser() user: { id: string },
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const correlation =
      req.headers['x-authority-correlation-id'] ??
      req.headers['x-correlation-id'];
    return this.specificFolders.cancelJob({
      companyId: tenancy.companyId,
      jobId: id,
      actorUserId: user.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      correlationId: typeof correlation === 'string' ? correlation : undefined,
    });
  }

  @Get('backups/:id/download')
  @RequirePermission(PERMISSION_KEYS.backupDestinationDownload)
  async downloadBackup(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const meta = await this.specificFolders.openDownloadStream(
      tenancy.companyId,
      id,
    );
    res.set({
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${meta.filename}"`,
    });
    return new StreamableFile(meta.stream);
  }
}
