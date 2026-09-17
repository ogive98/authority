import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { IamUser } from '@prisma/client';
import { CurrentUser } from '../identity/identity.decorators';
import { SessionGuard } from '../identity/session.guard';
import { CurrentTenancy } from '../organization/organization.decorators';
import type { TenancyContext } from '../organization/organization.constants';
import { TenancyGuard } from '../organization/tenancy.guard';
import { ModuleGuard } from '../modules-registry/module.guard';
import { RequireModule } from '../modules-registry/modules.decorators';
import { PermissionGuard } from '../permissions/permission.guard';
import { RequirePermission } from '../permissions/permission.decorators';
import { PERMISSION_KEYS } from '../permissions/permission.constants';
import { ExtensionRegistryService } from './extension-registry.service';
import { FeatureRequestService } from './feature-request.service';
import { MetadataRegistryService } from './metadata-registry.service';
import {
  CreateFeatureRequestDto,
  CreateMetadataDefinitionDto,
  RegisterExtensionDto,
  TransitionExtensionDto,
  TransitionFeatureRequestDto,
  TransitionMetadataDto,
} from './forge.dto';
import { toForgeTenantContext } from './tenant-context.util';

@Controller('api/v1/forge')
@UseGuards(SessionGuard, ModuleGuard, TenancyGuard, PermissionGuard)
@RequireModule('forge')
export class ForgeController {
  constructor(
    private readonly extensions: ExtensionRegistryService,
    private readonly featureRequests: FeatureRequestService,
    private readonly metadata: MetadataRegistryService,
  ) {}

  @Get('overview')
  @RequirePermission(PERMISSION_KEYS.forgeRead)
  async overview(@CurrentTenancy() tenancy: TenancyContext) {
    const ctx = toForgeTenantContext(tenancy);
    const [ext, fr, metaCov] = await Promise.all([
      this.extensions.list(ctx),
      this.featureRequests.list(ctx),
      this.metadata.coverage(ctx),
    ]);
    const byStatus = (items: { status: string }[]) => {
      const m: Record<string, number> = {};
      for (const i of items) m[i.status] = (m[i.status] ?? 0) + 1;
      return m;
    };
    return {
      extensions: {
        total: ext.items.length,
        byStatus: byStatus(ext.items),
      },
      featureRequests: {
        total: fr.items.length,
        byStatus: byStatus(fr.items),
      },
      metadata: {
        total: metaCov.total,
        byStatus: metaCov.byStatus,
        byType: metaCov.byType,
        activeWithCommandId: metaCov.activeWithCommandId,
      },
      phase: 'metadata-bridge',
      ai: 'UNAVAILABLE' as const,
      sandbox: 'UNAVAILABLE' as const,
    };
  }

  @Get('extensions')
  @RequirePermission(PERMISSION_KEYS.forgeRead)
  listExtensions(@CurrentTenancy() tenancy: TenancyContext) {
    return this.extensions.list(toForgeTenantContext(tenancy));
  }

  @Get('extensions/:id')
  @RequirePermission(PERMISSION_KEYS.forgeRead)
  getExtension(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.extensions.get(toForgeTenantContext(tenancy), id);
  }

  @Post('extensions')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.forgeWrite)
  registerExtension(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Body() dto: RegisterExtensionDto,
  ) {
    return this.extensions.register(
      toForgeTenantContext(tenancy, user.id),
      dto,
    );
  }

  /** Lifecycle transitions except APPROVED / ACTIVE (use approve / activate). */
  @Post('extensions/:id/transition')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.forgeWrite)
  transitionExtension(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionExtensionDto,
  ) {
    return this.extensions.transitionStatus(
      toForgeTenantContext(tenancy, user.id),
      id,
      dto.status,
    );
  }

  @Post('extensions/:id/approve')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.forgeApprove)
  approveExtension(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.extensions.transitionStatus(
      toForgeTenantContext(tenancy, user.id),
      id,
      'APPROVED',
      { allowApproveActivate: true },
    );
  }

  @Post('extensions/:id/activate')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.forgeApprove)
  activateExtension(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.extensions.transitionStatus(
      toForgeTenantContext(tenancy, user.id),
      id,
      'ACTIVE',
      { allowApproveActivate: true },
    );
  }

  @Get('feature-requests')
  @RequirePermission(PERMISSION_KEYS.forgeRead)
  listFeatureRequests(@CurrentTenancy() tenancy: TenancyContext) {
    return this.featureRequests.list(toForgeTenantContext(tenancy));
  }

  @Get('feature-requests/:id')
  @RequirePermission(PERMISSION_KEYS.forgeRead)
  getFeatureRequest(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.featureRequests.get(toForgeTenantContext(tenancy), id);
  }

  @Post('feature-requests')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.forgeWrite)
  createFeatureRequest(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Body() dto: CreateFeatureRequestDto,
  ) {
    return this.featureRequests.create(
      toForgeTenantContext(tenancy, user.id),
      {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        source: (dto.source as 'manual' | 'support' | 'import') ?? 'manual',
        affectedModules: dto.affectedModules,
        extensionId: dto.extensionId,
      },
    );
  }

  @Post('feature-requests/:id/transition')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.forgeWrite)
  transitionFeatureRequest(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionFeatureRequestDto,
  ) {
    return this.featureRequests.transitionStatus(
      toForgeTenantContext(tenancy, user.id),
      id,
      dto.status,
    );
  }

  @Get('metadata')
  @RequirePermission(PERMISSION_KEYS.forgeRead)
  listMetadata(@CurrentTenancy() tenancy: TenancyContext) {
    return this.metadata.list(toForgeTenantContext(tenancy));
  }

  @Get('metadata/coverage')
  @RequirePermission(PERMISSION_KEYS.forgeRead)
  metadataCoverage(@CurrentTenancy() tenancy: TenancyContext) {
    return this.metadata.coverage(toForgeTenantContext(tenancy));
  }

  /** ACTIVE rows for AUTHORITY FeatureMetadata bridge (aliases / tags). */
  @Get('metadata/bridge')
  @RequirePermission(PERMISSION_KEYS.forgeRead)
  metadataBridge(@CurrentTenancy() tenancy: TenancyContext) {
    return this.metadata.listActiveForBridge(toForgeTenantContext(tenancy));
  }

  @Get('metadata/:id')
  @RequirePermission(PERMISSION_KEYS.forgeRead)
  getMetadata(
    @CurrentTenancy() tenancy: TenancyContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.metadata.get(toForgeTenantContext(tenancy), id);
  }

  @Post('metadata')
  @HttpCode(201)
  @RequirePermission(PERMISSION_KEYS.forgeWrite)
  createMetadata(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Body() dto: CreateMetadataDefinitionDto,
  ) {
    return this.metadata.create(toForgeTenantContext(tenancy, user.id), {
      key: dto.key,
      type: dto.type,
      moduleKey: dto.moduleKey,
      extensionId: dto.extensionId,
      schemaJson: dto.schemaJson,
    });
  }

  @Post('metadata/:id/transition')
  @HttpCode(200)
  @RequirePermission(PERMISSION_KEYS.forgeWrite)
  transitionMetadata(
    @CurrentTenancy() tenancy: TenancyContext,
    @CurrentUser() user: IamUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionMetadataDto,
  ) {
    return this.metadata.transitionStatus(
      toForgeTenantContext(tenancy, user.id),
      id,
      dto.status,
    );
  }
}
