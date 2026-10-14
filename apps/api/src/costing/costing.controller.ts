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
import { CostingService } from './costing.service';
import { RunRollupDto } from './costing.dto';

@Controller('api/v1/costing')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard)
@RequireModule('costing')
export class CostingController {
  constructor(private readonly costingService: CostingService) {}

  @Post('rollups')
  @HttpCode(201)
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.costingRun)
  async runRollup(
    @Body() dto: RunRollupDto,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.costingService.runRollup(tenancy.companyId, dto.period);
  }

  @Get('rolls')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.costingRead)
  async listRolls(@CurrentTenancy() tenancy: { companyId: string }) {
    return this.costingService.listRolls(tenancy.companyId);
  }

  @Get('products/:productId')
  @UseGuards(PermissionGuard)
  @RequirePermission(PERMISSION_KEYS.costingRead)
  async getProductCost(
    @Param('productId') productId: string,
    @CurrentTenancy() tenancy: { companyId: string },
  ) {
    return this.costingService.getProductCost(tenancy.companyId, productId);
  }
}
