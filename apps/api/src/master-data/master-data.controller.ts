import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MdPartyType, MdRefKind } from '@prisma/client';
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

class CreatePartyDto {
  @IsEnum(MdPartyType)
  type!: MdPartyType;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  legalName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  defaultLang?: string;
}

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

  @Get('parties')
  @RequirePermission(PERMISSION_KEYS.masterDataPartyRead)
  listParties(
    @CurrentTenancy() tenancy: TenancyContext,
    @Query('q') q?: string,
    @Query('type') typeRaw?: string,
  ) {
    const type = parsePartyType(typeRaw);
    return this.masterData.listParties(tenancy.companyId, { q, type });
  }

  @Get('parties/:id')
  @RequirePermission(PERMISSION_KEYS.masterDataPartyRead)
  getParty(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.masterData.getParty(tenancy.companyId, id);
  }

  @Post('parties')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.masterDataPartyWrite)
  async createParty(
    @CurrentTenancy() tenancy: TenancyContext,
    @Body() dto: CreatePartyDto,
  ) {
    const row = await this.masterData.createParty(tenancy.companyId, dto);
    return this.masterData.getParty(tenancy.companyId, row.id);
  }
}

function parseKind(raw?: string): MdRefKind | undefined {
  if (!raw) return undefined;
  const values = Object.values(MdRefKind) as string[];
  if (!values.includes(raw)) return undefined;
  return raw as MdRefKind;
}

function parsePartyType(raw?: string): MdPartyType | undefined {
  if (!raw) return undefined;
  const values = Object.values(MdPartyType) as string[];
  if (!values.includes(raw)) return undefined;
  return raw as MdPartyType;
}
