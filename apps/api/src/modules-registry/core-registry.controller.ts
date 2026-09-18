import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../identity/identity.decorators';
import { SessionGuard } from '../identity/session.guard';
import { AuthorityIndexService } from './catalog/authority-index.service';
import { ModuleGuard } from './module.guard';
import { RequireModule } from './modules.decorators';

/**
 * Internal discovery façade (D295). Session + platform module required.
 * Not a public marketplace API. Does not scan source in production.
 */
@Controller('api/v1/core/registry')
@UseGuards(SessionGuard, ModuleGuard)
@RequireModule('platform')
export class CoreRegistryController {
  constructor(private readonly index: AuthorityIndexService) {}

  @Get()
  summary(@CurrentUser() user: { id: string }, @Req() req: Request) {
    return this.index.summary(
      user.id,
      req.headers,
      (req.cookies ?? {}) as Record<string, string | undefined>,
    );
  }

  @Get('modules')
  async modules(@CurrentUser() user: { id: string }, @Req() req: Request) {
    return {
      modules: await this.index.modules(
        user.id,
        req.headers,
        (req.cookies ?? {}) as Record<string, string | undefined>,
      ),
    };
  }

  @Get('features')
  async features(@CurrentUser() user: { id: string }, @Req() req: Request) {
    return {
      features: await this.index.features(
        user.id,
        req.headers,
        (req.cookies ?? {}) as Record<string, string | undefined>,
      ),
    };
  }

  @Get('capabilities')
  async capabilities(@CurrentUser() user: { id: string }, @Req() req: Request) {
    return {
      capabilities: await this.index.capabilities(
        user.id,
        req.headers,
        (req.cookies ?? {}) as Record<string, string | undefined>,
      ),
    };
  }

  @Get('events')
  events() {
    return { events: this.index.listEvents() };
  }

  @Get('dependencies')
  dependencies() {
    return { dependencies: this.index.listDependencies() };
  }

  @Get('commands')
  commands() {
    return { commands: this.index.listCommands() };
  }

  @Get('queries')
  queries() {
    return { queries: this.index.listQueries() };
  }

  @Get('configuration')
  configuration() {
    return { configuration: this.index.listConfiguration() };
  }

  @Get('extension-points')
  extensionPoints() {
    return { extensionPoints: this.index.listExtensionPoints() };
  }
}
