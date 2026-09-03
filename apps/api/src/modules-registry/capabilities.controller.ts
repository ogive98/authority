import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../identity/identity.decorators';
import { SessionGuard } from '../identity/session.guard';
import { ModuleCatalogService } from './catalog/module-catalog.service';
import { ModuleGuard } from './module.guard';
import { ModuleRegistryService } from './module-registry.service';
import { RequireModule } from './modules.decorators';

@Controller('api/v1/capabilities')
@UseGuards(SessionGuard, ModuleGuard)
@RequireModule('platform')
export class CapabilitiesController {
  constructor(
    private readonly catalog: ModuleCatalogService,
    private readonly moduleRegistry: ModuleRegistryService,
  ) {}

  @Get()
  async list(@CurrentUser() user: { id: string }, @Req() req: Request) {
    const companyId = await this.moduleRegistry.resolveCompanyId(
      user.id,
      req.headers,
      (req.cookies ?? {}) as Record<string, string | undefined>,
    );
    if (!companyId) {
      return { capabilities: [] };
    }

    const capabilities =
      await this.catalog.listEffectiveCapabilities(companyId);
    return {
      capabilities: capabilities.map((cap) => ({
        key: cap.key,
        moduleId: cap.moduleId,
        version: cap.version,
        description: cap.description ?? null,
        permissionKey: cap.permissionKey ?? null,
        riskLevel: cap.riskLevel ?? null,
      })),
    };
  }
}
