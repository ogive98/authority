import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import {
  CreateBulletinDto,
  CreateCnssSnapshotDto,
  CreateContractDto,
  CreateEmployeeDto,
  CreateIrppSnapshotDto,
  EndContractDto,
  PatchContractDto,
  PatchEmployeeDto,
  ReplaceIrppBracketsDto,
} from './hr.dto';
import { HrService } from './hr.service';
import { CnssService } from './cnss.service';
import { IrppService } from './irpp.service';
import { BulletinService } from './bulletin.service';
import { ExpertiseResolverService } from '../settings/expertise-resolver.service';

@Controller('api/v1/hr')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('hr')
export class HrController {
  constructor(
    private readonly hr: HrService,
    private readonly cnss: CnssService,
    private readonly irpp: IrppService,
    private readonly bulletin: BulletinService,
    private readonly permissions: PermissionService,
    private readonly expertise: ExpertiseResolverService,
  ) {}

  /**
   * CNSS / IRPP / TFP readiness (D092/D195/D196) — null until expert validates in Préférences.
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
      note: 'CNSS/IRPP use VALIDATED Prefs + human brackets only — never invent rates.',
    };
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
