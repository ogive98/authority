import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../identity/session.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { BomService } from './bom.service';
import { AddLinesDto, CreateRecipeDto } from './bom.dto';

@Controller('api/v1/bom')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard)
@RequireModule('bom')
export class BomController {
  constructor(private readonly bomService: BomService) {}

  @Get('recipes')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.bomRead)
  async listRecipes(@CurrentTenancy() tenancy: { companyId: string }) {
    const recipes = await this.bomService.listRecipes(tenancy.companyId);
    return recipes.map((r) => ({
      id: r.id,
      number: r.number,
      productId: r.productId,
      version: r.version,
      status: r.status,
      yield: r.yield.toFixed(3),
      notes: r.notes,
      lines: r.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        qty: l.qty.toFixed(3),
        uom: l.uom,
        scrapPct: l.scrapPct.toFixed(2),
        step: l.step,
      })),
      createdAt: r.createdAt,
    }));
  }

  @Get('recipes/:id')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.bomRead)
  async getRecipe(
    @Param('id') id: string,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    const recipe = await this.bomService.getRecipe(tenancy.companyId, id);
    return {
      id: recipe.id,
      number: recipe.number,
      productId: recipe.productId,
      version: recipe.version,
      status: recipe.status,
      yield: recipe.yield.toFixed(3),
      notes: recipe.notes,
      lines: recipe.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        qty: l.qty.toFixed(3),
        uom: l.uom,
        scrapPct: l.scrapPct.toFixed(2),
        step: l.step,
      })),
      createdAt: recipe.createdAt,
    };
  }

  @Post('recipes')
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.bomWrite)
  async createRecipe(
    @Body() dto: CreateRecipeDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    const recipe = await this.bomService.createRecipe(tenancy.companyId, dto);
    return {
      id: recipe.id,
      number: recipe.number,
      productId: recipe.productId,
      version: recipe.version,
      status: recipe.status,
      yield: recipe.yield.toFixed(3),
      notes: recipe.notes,
      lines: [],
      createdAt: recipe.createdAt,
    };
  }

  @Post('recipes/:id/lines')
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.bomWrite)
  async addLines(
    @Param('id') id: string,
    @Body() dto: AddLinesDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    const recipe = await this.bomService.addLines(
      tenancy.companyId,
      id,
      dto.lines,
    );
    return {
      id: recipe.id,
      number: recipe.number,
      productId: recipe.productId,
      version: recipe.version,
      status: recipe.status,
      yield: recipe.yield.toFixed(3),
      notes: recipe.notes,
      lines: recipe.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        qty: l.qty.toFixed(3),
        uom: l.uom,
        scrapPct: l.scrapPct.toFixed(2),
        step: l.step,
      })),
      createdAt: recipe.createdAt,
    };
  }

  @Post('recipes/:id/activate')
  @HttpCode(200)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.bomActivate)
  async activateRecipe(
    @Param('id') id: string,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    const recipe = await this.bomService.activateRecipe(
      tenancy.companyId,
      id,
    );
    return {
      id: recipe.id,
      number: recipe.number,
      productId: recipe.productId,
      version: recipe.version,
      status: recipe.status,
      yield: recipe.yield.toFixed(3),
      notes: recipe.notes,
      lines: recipe.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        qty: l.qty.toFixed(3),
        uom: l.uom,
        scrapPct: l.scrapPct.toFixed(2),
        step: l.step,
      })),
      createdAt: recipe.createdAt,
    };
  }
}
