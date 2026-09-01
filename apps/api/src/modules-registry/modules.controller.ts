import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../identity/identity.decorators';
import { SessionGuard } from '../identity/session.guard';
import { FeatureFlagService } from './feature-flag.service';
import { ModuleGuard } from './module.guard';
import { ModuleRegistryService } from './module-registry.service';
import { RequireModule } from './modules.decorators';

@Controller('api/v1/modules')
@UseGuards(SessionGuard, ModuleGuard)
@RequireModule('platform')
export class ModulesController {
  constructor(
    private readonly moduleRegistry: ModuleRegistryService,
    private readonly flags: FeatureFlagService,
  ) {}

  @Get()
  async list(@CurrentUser() user: { id: string }, @Req() req: Request) {
    const companyId = await this.moduleRegistry.resolveCompanyId(
      user.id,
      req.headers,
      (req.cookies ?? {}) as Record<string, string | undefined>,
    );
    if (!companyId) {
      return { modules: [], flags: [] };
    }

    const [modules, flags] = await Promise.all([
      this.moduleRegistry.listStates(companyId),
      this.flags.listFlags(companyId),
    ]);

    return {
      modules: modules.map((row) => ({
        key: row.moduleKey,
        status: row.status,
      })),
      flags: flags.map((row) => ({
        key: row.flagKey,
        enabled: row.enabled,
      })),
    };
  }
}
