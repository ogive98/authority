import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { createReadStream } from 'fs';
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
  AdjustLotDto,
  AdjustStockDto,
  CreateLotDto,
  CreateWarehouseDto,
  GenerateDailyLotsDto,
  PatchCheeseArticleDto,
  PatchLotStatusDto,
  PreviewDlcDto,
  ReleaseStockDto,
  ReserveStockDto,
  UpsertCheeseArticleDto,
} from './inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('api/v1/inventory')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('warehouses')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  listWarehouses(@CurrentTenancy() tenancy: TenancyContext) {
    return this.inventoryService.listWarehouses(tenancy.companyId);
  }

  @Get('home-kpis')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  homeKpis(@CurrentTenancy() tenancy: TenancyContext) {
    return this.inventoryService.homeKpis(tenancy.companyId);
  }

  @Post('warehouses')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.inventoryWrite)
  createWarehouse(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.inventoryService.createWarehouse(tenancy.companyId, dto);
  }

  @Get('balances')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  listBalances(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.inventoryService.listBalances(tenancy.companyId, {
      q,
      warehouseId,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Get('lots')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  listLots(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('limit') limitRaw?: string,
    @Query('cursor') cursor?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.inventoryService.listLots(tenancy.companyId, {
      q,
      warehouseId,
      productId,
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor,
    });
  }

  @Post('lots')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.inventoryWrite)
  createLot(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreateLotDto,
  ) {
    return this.inventoryService.createLot(tenancy.companyId, dto);
  }

  @Post('lots/adjust')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.inventoryWrite)
  adjustLot(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: AdjustLotDto,
  ) {
    return this.inventoryService.adjustLot(tenancy.companyId, dto);
  }

  @Post('lots/:lotId/status')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.inventoryWrite)
  patchLotStatus(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('lotId') lotId: string,
    @Body() dto: PatchLotStatusDto,
  ) {
    return this.inventoryService.patchLotStatus(
      tenancy.companyId,
      lotId,
      dto,
    );
  }

  @Get('movements')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  listMovements(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('balanceId') balanceId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.inventoryService.listMovements(tenancy.companyId, {
      balanceId,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

  @Post('adjust')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.inventoryWrite)
  adjust(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventoryService.adjust(tenancy.companyId, dto);
  }

  @Post('reserve')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.inventoryReserve)
  reserve(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: ReserveStockDto,
  ) {
    return this.inventoryService.reserve(tenancy.companyId, dto);
  }

  @Post('release')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.inventoryReserve)
  release(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: ReleaseStockDto,
  ) {
    return this.inventoryService.release(tenancy.companyId, dto);
  }

  @Get('cheese-articles')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  listCheeseArticles(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('active') active?: string,
  ) {
    const activeOnly =
      active === '1' || active === 'true'
        ? true
        : active === '0' || active === 'false'
          ? false
          : undefined;
    return this.inventoryService.listCheeseArticles(tenancy.companyId, {
      activeOnly,
    });
  }

  @Post('cheese-articles')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.inventoryWrite)
  upsertCheeseArticle(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: UpsertCheeseArticleDto,
  ) {
    return this.inventoryService.upsertCheeseArticle(tenancy.companyId, dto);
  }

  @Patch('cheese-articles/:id')
  @RequirePermission(PERMISSION_KEYS.inventoryWrite)
  patchCheeseArticle(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id') id: string,
    @Body() dto: PatchCheeseArticleDto,
  ) {
    return this.inventoryService.patchCheeseArticle(tenancy.companyId, id, dto);
  }

  @Post('cheese-articles/preview-dlc')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  previewDlc(@Body() dto: PreviewDlcDto) {
    return this.inventoryService.previewDlc(dto);
  }

  @Post('cheese-articles/generate-daily')
  @RequirePermission(PERMISSION_KEYS.inventoryWrite)
  generateDaily(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: GenerateDailyLotsDto,
  ) {
    return this.inventoryService.generateDailyCheeseLots(tenancy.companyId, {
      packDate: dto.packDate,
      warehouseId: dto.warehouseId,
    });
  }

  @Get('salubrita/certificate')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  salubritaCertificate(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('packDate') packDate?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventoryService.listSalubritaCertificate(tenancy.companyId, {
      packDate,
      warehouseId,
    });
  }

  @Get('salubrita/history')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  salubritaHistory(@CurrentTenancy() tenancy: TenancyContext) {
    return this.inventoryService.listSalubritaHistory(tenancy.companyId);
  }

  @Get('salubrita/recipients')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  salubritaRecipients(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('channel') channel?: string,
    @Query('q') q?: string,
  ) {
    return this.inventoryService.listSalubritaRecipients(tenancy.companyId, {
      channel: channel as 'email' | 'whatsapp' | 'portal' | undefined,
      q,
    });
  }

  /** D128 — Word model (OOXML zip stored as template.zip). */
  @Get('salubrita/template')
  @RequirePermission(PERMISSION_KEYS.inventoryRead)
  salubritaTemplate(): StreamableFile {
    const path = this.inventoryService.resolveSalubritaTemplatePath();
    return new StreamableFile(createReadStream(path), {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      disposition:
        'attachment; filename="certificat-salubrita-template.docx"',
    });
  }
}
