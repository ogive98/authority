import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { IamUser } from '@prisma/client';
import { CurrentUser } from '../identity/identity.decorators';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { SessionGuard } from '../identity/session.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import {
  CalculateTaxDto,
  CreateTaxRateDto,
  DetectRasDto,
  AckTejImportDto,
  GenerateTejInvoicePackDto,
  GenerateTejLocalDto,
  PatchTaxRateDto,
  RecordTejResultDto,
} from './tax.dto';
import { TaxService } from './tax.service';
import { TejLocalService } from './tej-local.service';
import { RasEngineService } from './ras-engine.service';
import { TejCenterService } from './tej-center.service';
import { TaxWithholdingStatus } from '@prisma/client';

@Controller('api/v1/tax')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('tax')
export class TaxController {
  constructor(
    private readonly taxService: TaxService,
    private readonly tejLocal: TejLocalService,
    private readonly ras: RasEngineService,
    private readonly tejCenter: TejCenterService,
  ) {}

  @Get('codes')
  @RequirePermission(PERMISSION_KEYS.taxRead)
  listCodes(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('allKinds') allKinds?: string,
  ) {
    const all = allKinds === '1' || allKinds === 'true';
    return this.taxService.listCodes(tenancy.companyId, {
      activeOnly: !all,
      allKinds: all,
    });
  }

  @Get('rates')
  @RequirePermission(PERMISSION_KEYS.taxRead)
  listRates(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('asOf') asOf?: string,
    @Query('taxCodeId') taxCodeId?: string,
  ) {
    return this.taxService.listRates(tenancy.companyId, { asOf, taxCodeId });
  }

  @Post('rates')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.taxRateManage)
  createRate(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateTaxRateDto,
  ) {
    return this.taxService.createRate(tenancy.companyId, dto);
  }

  @Patch('rates/:id')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.taxRateManage)
  patchRate(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchTaxRateDto,
  ) {
    return this.taxService.patchRate(tenancy.companyId, id, dto);
  }

  /** Canonical engine endpoint (D259). CDC alias: POST /tax/compute. */
  @Post(['calculate', 'compute'])
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.taxRead)
  calculate(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CalculateTaxDto,
  ) {
    return this.taxService.calculate(tenancy.companyId, dto);
  }

  /** D265 — local TEJ draft history (hash only; transmission always DISABLED). */
  @Get('tej/exports')
  @RequirePermission(PERMISSION_KEYS.taxRead)
  listTejExports(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : undefined;
    return this.tejLocal.list(tenancy.companyId, {
      limit: Number.isFinite(n) ? n : undefined,
    });
  }

  @Get('tej/exports/:id')
  @RequirePermission(PERMISSION_KEYS.taxRead)
  getTejExport(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tejLocal.get(tenancy.companyId, id);
  }

  @Post('tej/exports')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.taxRateManage)
  generateTejExport(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Body() dto: GenerateTejLocalDto,
  ) {
    return this.tejLocal.generate(tenancy.companyId, {
      periodLabel: dto.periodLabel,
      createdByUserId: user.id,
    });
  }

  /** D285 — pack CERTIFICATE_READY → local XML · mark TEJ_PREPARED (no transmission). */
  @Post('tej/packs')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.taxRateManage)
  generateTejPack(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Body() dto: GenerateTejLocalDto,
  ) {
    return this.tejLocal.generatePack(tenancy.companyId, {
      periodLabel: dto.periodLabel,
      createdByUserId: user.id,
      side: dto.side === 'AR' || dto.side === 'AP' ? dto.side : undefined,
    });
  }

  /** D286 — pack XML for one AR invoice withholding. */
  @Post('tej/packs/invoice')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.taxRateManage)
  generateTejInvoicePack(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Body() dto: GenerateTejInvoicePackDto,
  ) {
    return this.tejLocal.generatePackForInvoice(tenancy.companyId, {
      arInvoiceId: dto.arInvoiceId,
      createdByUserId: user.id,
    });
  }

  /** D282 — TEJ Center Soft Glass hub (counters; transmission DISABLED). */
  @Get('tej-center/overview')
  @RequirePermission(PERMISSION_KEYS.taxRead)
  tejCenterOverview(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('periodLabel') periodLabel?: string,
  ) {
    return this.tejCenter.overview(tenancy.companyId, periodLabel);
  }

  @Get('withholdings')
  @RequirePermission(PERMISSION_KEYS.taxRead)
  listWithholdings(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('status') status?: string,
    @Query('periodLabel') periodLabel?: string,
    @Query('apPaymentId') apPaymentId?: string,
    @Query('arInvoiceId') arInvoiceId?: string,
    @Query('side') side?: string,
  ) {
    const st =
      status &&
      Object.values(TaxWithholdingStatus).includes(
        status as TaxWithholdingStatus,
      )
        ? (status as TaxWithholdingStatus)
        : undefined;
    const sideFilter =
      side === 'AP' || side === 'AR' ? (side as 'AP' | 'AR') : undefined;
    return this.ras.list(tenancy.companyId, {
      status: st,
      periodLabel,
      apPaymentId: apPaymentId?.trim() || undefined,
      arInvoiceId: arInvoiceId?.trim() || undefined,
      side: sideFilter,
    });
  }

  @Get('withholdings/:id')
  @RequirePermission(PERMISSION_KEYS.taxRead)
  getWithholding(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ras.get(tenancy.companyId, id);
  }

  @Post('withholdings/detect')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.taxRead)
  detectRas(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: DetectRasDto,
  ) {
    return this.ras.detect(tenancy.companyId, dto);
  }

  @Post('withholdings')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.taxRateManage)
  createWithholding(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: DetectRasDto,
  ) {
    return this.ras.createFromDetect(tenancy.companyId, dto);
  }

  @Post('withholdings/:id/validate')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.taxRateManage)
  validateWithholding(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ras.validate(tenancy.companyId, id);
  }

  /** D284 — local RAS certificate (not official MF form). */
  @Post('withholdings/:id/certificate')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.taxRateManage)
  generateCertificate(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ras.generateCertificate(tenancy.companyId, id);
  }

  @Get('withholdings/:id/certificate')
  @RequirePermission(PERMISSION_KEYS.taxRead)
  getCertificate(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ras.getCertificate(tenancy.companyId, id);
  }

  /** D287 — local Tej import ack (TEJ_PREPARED → TRANSMITTED). No upload. */
  @Post('withholdings/:id/tej-import-ack')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.taxRateManage)
  ackTejImport(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AckTejImportDto,
  ) {
    return this.ras.ackTejImport(tenancy.companyId, id, {
      note: dto.note,
    });
  }

  /** D287 — record Tej accept/reject locally (TRANSMITTED → ACCEPTED|REJECTED). */
  @Post('withholdings/:id/tej-result')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.taxRateManage)
  recordTejResult(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordTejResultDto,
  ) {
    return this.ras.recordTejResult(tenancy.companyId, id, {
      result: dto.result,
      note: dto.note,
      rejectReason: dto.rejectReason,
    });
  }

  /** D287 — ACCEPTED|REJECTED → ARCHIVED. */
  @Post('withholdings/:id/archive')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.taxRateManage)
  archiveWithholding(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ras.archive(tenancy.companyId, id);
  }
}
