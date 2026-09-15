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
  GenerateTejLocalDto,
  PatchTaxRateDto,
} from './tax.dto';
import { TaxService } from './tax.service';
import { TejLocalService } from './tej-local.service';

@Controller('api/v1/tax')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('tax')
export class TaxController {
  constructor(
    private readonly taxService: TaxService,
    private readonly tejLocal: TejLocalService,
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
}
