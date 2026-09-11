import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { IamUser } from '@prisma/client';
import { SessionGuard } from '../identity/session.guard';
import { CurrentUser } from '../identity/identity.decorators';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { PermissionService } from '../permissions/permission.service';
import { DEFAULT_MAX_UPLOAD_MB } from '../platform/platform.constants';
import {
  CreateBulletinDto,
  CreateCnssSnapshotDto,
  CreateContractDto,
  CreateEmployeeDto,
  CreateIrppSnapshotDto,
  CreateJobTitleDto,
  EndContractDto,
  PatchContractDto,
  PatchEmployeeDto,
  PatchJobTitleDto,
  ReplaceIrppBracketsDto,
} from './hr.dto';
import { HrService } from './hr.service';
import { CnssService } from './cnss.service';
import { IrppService } from './irpp.service';
import { BulletinService } from './bulletin.service';
import { BulletinPdfService } from './bulletin-pdf.service';
import { ExpertiseResolverService } from '../settings/expertise-resolver.service';
import { LevyService } from './levy.service';
import { JobTitleService } from './job-title.service';
import { HR_ERROR_CODES, isHrImageMime } from './hr.constants';
import { HrException } from './hr.exception';
import { HrDocumentService } from './hr-document.service';

const maxUploadBytes =
  Number(process.env.MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;

@Controller('api/v1/hr')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('hr')
export class HrController {
  constructor(
    private readonly hr: HrService,
    private readonly cnss: CnssService,
    private readonly irpp: IrppService,
    private readonly bulletin: BulletinService,
    private readonly bulletinPdf: BulletinPdfService,
    private readonly expertise: ExpertiseResolverService,
    private readonly permissions: PermissionService,
    private readonly levies: LevyService,
    private readonly jobTitles: JobTitleService,
    private readonly hrDocuments: HrDocumentService,
  ) {}

  /**
   * CNSS / IRPP / TFP / FOPROLOS readiness — null until expert validates in Préférences.
   */
  @Get('expertise-hints')
  @RequirePermission(PERMISSION_KEYS.hrEmployeeRead)
  async expertiseHints(@CurrentTenancy() tenancy: TenancyContext) {
    const snap = await this.expertise.getHrContributionSnapshot(
      tenancy.companyId,
    );
    return {
      companyId: tenancy.companyId,
      ...snap,
      prefsHref: '/settings#expertise',
      note: 'CNSS/IRPP/TFP/FOPROLOS use VALIDATED Prefs only — never invent rates.',
    };
  }

  @Get('levies/preview')
  @RequirePermission(PERMISSION_KEYS.hrWageRead)
  leviesPreview(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('contractId', ParseUUIDPipe) contractId: string,
  ) {
    return this.levies.preview(tenancy.companyId, contractId);
  }

  @Get('job-titles')
  @RequirePermission(PERMISSION_KEYS.hrEmployeeRead)
  listJobTitles(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('activeOnly') activeOnlyRaw?: string,
  ) {
    const activeOnly =
      activeOnlyRaw === '1' || activeOnlyRaw === 'true';
    return this.jobTitles.list(tenancy.companyId, { activeOnly });
  }

  @Post('job-titles')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.hrEmployeeWrite)
  createJobTitle(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateJobTitleDto,
  ) {
    return this.jobTitles.create(tenancy.companyId, dto);
  }

  @Patch('job-titles/:id')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.hrEmployeeWrite)
  patchJobTitle(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchJobTitleDto,
  ) {
    return this.jobTitles.patch(tenancy.companyId, id, dto);
  }

  @Get('cnss/preview')
  @RequirePermission(PERMISSION_KEYS.hrWageRead)
  cnssPreview(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('contractId', ParseUUIDPipe) contractId: string,
    @Query('periodYm') periodYm?: string,
  ) {
    return this.cnss.preview(tenancy.companyId, contractId, periodYm);
  }

  @Get('cnss/snapshots')
  @RequirePermission(PERMISSION_KEYS.hrWageRead)
  listCnssSnapshots(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('periodYm') periodYm?: string,
    @Query('employeeId') employeeId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.cnss.listSnapshots(tenancy.companyId, {
      periodYm,
      employeeId,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Post('cnss/snapshots')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.hrEmployeeWrite)
  createCnssSnapshot(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateCnssSnapshotDto,
  ) {
    return this.cnss.createSnapshot(tenancy.companyId, dto);
  }

  @Get('irpp/brackets')
  @RequirePermission(PERMISSION_KEYS.settingsCompanyWrite)
  listIrppBrackets(@CurrentTenancy() tenancy: TenancyContext) {
    return this.irpp.listBrackets(tenancy.companyId);
  }

  @Put('irpp/brackets')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.settingsCompanyWrite)
  replaceIrppBrackets(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: ReplaceIrppBracketsDto,
  ) {
    return this.irpp.replaceBrackets(
      tenancy.companyId,
      dto.brackets.map((b) => ({
        upToMilli: b.upToMilli ?? null,
        rateBps: b.rateBps,
        lawRef: b.lawRef ?? null,
      })),
    );
  }

  @Get('irpp/preview')
  @RequirePermission(PERMISSION_KEYS.hrWageRead)
  irppPreview(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('contractId', ParseUUIDPipe) contractId: string,
    @Query('periodYm') periodYm?: string,
  ) {
    return this.irpp.preview(tenancy.companyId, contractId, periodYm);
  }

  @Get('irpp/snapshots')
  @RequirePermission(PERMISSION_KEYS.hrWageRead)
  listIrppSnapshots(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('periodYm') periodYm?: string,
    @Query('employeeId') employeeId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.irpp.listSnapshots(tenancy.companyId, {
      periodYm,
      employeeId,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Post('irpp/snapshots')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.hrEmployeeWrite)
  createIrppSnapshot(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateIrppSnapshotDto,
  ) {
    return this.irpp.createSnapshot(tenancy.companyId, dto);
  }

  @Get('bulletins/preview')
  @RequirePermission(PERMISSION_KEYS.hrWageRead)
  bulletinPreview(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('contractId', ParseUUIDPipe) contractId: string,
    @Query('periodYm') periodYm?: string,
  ) {
    return this.bulletin.preview(tenancy.companyId, contractId, periodYm);
  }

  @Get('bulletins')
  @RequirePermission(PERMISSION_KEYS.hrWageRead)
  listBulletins(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('periodYm') periodYm?: string,
    @Query('employeeId') employeeId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.bulletin.list(tenancy.companyId, {
      periodYm,
      employeeId,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Post('bulletins')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.hrEmployeeWrite)
  createBulletin(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateBulletinDto,
  ) {
    return this.bulletin.create(tenancy.companyId, dto);
  }

  @Get('bulletins/:id')
  @RequirePermission(PERMISSION_KEYS.hrWageRead)
  getBulletin(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bulletin.getById(tenancy.companyId, id);
  }

  /** D202 — HTML→PDF stream + persist Documents (link HR_BULLETIN). */
  @Get('bulletins/:id/pdf')
  @RequirePermission(PERMISSION_KEYS.hrWageRead)
  async getBulletinPdf(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const result = await this.bulletinPdf.generateAndPersist(
      tenancy.companyId,
      user.id,
      id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader('X-Authority-Document-Id', result.documentId);
    return new StreamableFile(result.buffer);
  }

  @Get('employees')
  @RequirePermission(PERMISSION_KEYS.hrEmployeeRead)
  async listEmployees(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    const includeWage = await this.permissions.evaluate(
      user.id,
      PERMISSION_KEYS.hrWageRead,
      { companyId: tenancy.companyId },
    );
    return this.hr.listEmployees(tenancy.companyId, {
      q,
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
      includeWage,
    });
  }

  @Get('employees/:id')
  @RequirePermission(PERMISSION_KEYS.hrEmployeeRead)
  async getEmployee(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const includeWage = await this.permissions.evaluate(
      user.id,
      PERMISSION_KEYS.hrWageRead,
      { companyId: tenancy.companyId },
    );
    return this.hr.getEmployee(tenancy.companyId, id, includeWage);
  }

  @Get('employees/:id/documents')
  @RequirePermission(PERMISSION_KEYS.hrEmployeeRead)
  listEmployeeDocuments(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.hrDocuments.list(tenancy.companyId, id);
  }

  @Post('employees/:id/documents')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.hrEmployeeWrite)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: maxUploadBytes } }),
  )
  uploadEmployeeDocument(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; originalname?: string },
    @Body() body: { title?: string },
  ) {
    return this.hrDocuments.upload(
      tenancy.companyId,
      user.id,
      id,
      file,
      body.title,
    );
  }

  @Get('employees/:id/documents/:docId/download')
  @RequirePermission(PERMISSION_KEYS.hrEmployeeRead)
  downloadEmployeeDocument(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
  ) {
    return this.hrDocuments.getDownload(tenancy.companyId, id, docId);
  }

  /** Inline stream for aperçu / impression (same IDOR as download). */
  @Get('employees/:id/documents/:docId/content')
  @RequirePermission(PERMISSION_KEYS.hrEmployeeRead)
  async streamEmployeeDocument(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('docId', ParseUUIDPipe) docId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.hrDocuments.getContent(
      tenancy.companyId,
      id,
      docId,
    );
    res.setHeader('Content-Type', file.mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.filename}"`,
    );
    res.setHeader('Cache-Control', 'private, max-age=60');
    return new StreamableFile(file.buffer);
  }

  @Post('employees/:id/photo')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.hrEmployeeWrite)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: maxUploadBytes } }),
  )
  async uploadEmployeePhoto(
    @CurrentUser() user: IamUser,
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile()
    file: { buffer: Buffer; mimetype: string; originalname?: string },
  ) {
    if (!file?.buffer || !isHrImageMime(file.mimetype)) {
      throw new HrException(
        HR_ERROR_CODES.PHOTO_INVALID,
        'Photo must be JPEG, PNG, WebP or GIF.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const includeWage = await this.permissions.evaluate(
      user.id,
      PERMISSION_KEYS.hrWageRead,
      { companyId: tenancy.companyId },
    );
    const doc = await this.hrDocuments.upload(
      tenancy.companyId,
      user.id,
      id,
      file,
      'Photo',
    );
    return this.hr.patchEmployee(
      tenancy.companyId,
      id,
      { photoDocumentId: doc.id },
      includeWage,
    );
  }

  @Post('employees')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.hrEmployeeWrite)
  async createEmployee(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Body() dto: CreateEmployeeDto,
  ) {
    const includeWage = await this.permissions.evaluate(
      user.id,
      PERMISSION_KEYS.hrWageRead,
      { companyId: tenancy.companyId },
    );
    return this.hr.createEmployee(tenancy.companyId, dto, includeWage);
  }

  @Patch('employees/:id')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.hrEmployeeWrite)
  async patchEmployee(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchEmployeeDto,
  ) {
    const includeWage = await this.permissions.evaluate(
      user.id,
      PERMISSION_KEYS.hrWageRead,
      { companyId: tenancy.companyId },
    );
    return this.hr.patchEmployee(tenancy.companyId, id, dto, includeWage);
  }

  @Post('contracts')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.hrEmployeeWrite)
  async createContract(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Body() dto: CreateContractDto,
  ) {
    const includeWage = await this.permissions.evaluate(
      user.id,
      PERMISSION_KEYS.hrWageRead,
      { companyId: tenancy.companyId },
    );
    return this.hr.createContract(tenancy.companyId, dto, includeWage);
  }

  @Patch('contracts/:id')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.hrEmployeeWrite)
  async patchContract(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchContractDto,
  ) {
    const includeWage = await this.permissions.evaluate(
      user.id,
      PERMISSION_KEYS.hrWageRead,
      { companyId: tenancy.companyId },
    );
    return this.hr.patchContract(tenancy.companyId, id, dto, includeWage);
  }

  @Post('contracts/:id/end')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.hrEmployeeWrite)
  async endContract(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndContractDto,
  ) {
    const includeWage = await this.permissions.evaluate(
      user.id,
      PERMISSION_KEYS.hrWageRead,
      { companyId: tenancy.companyId },
    );
    return this.hr.endContract(tenancy.companyId, id, dto, includeWage);
  }
}
