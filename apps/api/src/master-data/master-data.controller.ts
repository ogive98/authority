import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MdRefKind } from '@prisma/client';
import { SessionGuard } from '../identity/session.guard';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { MasterDataService } from './master-data.service';

@Controller('api/v1/master-data')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('master_data')
export class MasterDataController {
  constructor(private readonly masterData: MasterDataService) {}

  @Get('refs')
  @RequirePermission(PERMISSION_KEYS.masterDataRefsRead)
  listRefs(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('kind') kindRaw?: string,
  ) {
    const kind = parseKind(kindRaw);
    return this.masterData.listRefs(tenancy.companyId, kind);
  }
}

function parseKind(raw?: string): MdRefKind | undefined {
  if (!raw) return undefined;
  const values = Object.values(MdRefKind) as string[];
  if (!values.includes(raw)) return undefined;
  return raw as MdRefKind;
}
