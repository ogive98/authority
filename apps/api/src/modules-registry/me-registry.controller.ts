import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../identity/identity.decorators';
import { SessionGuard } from '../identity/session.guard';
import { MeFieldAclService } from './me-field-acl.service';
import { MeRegistryService } from './me-registry.service';

/**
 * Shell navigation registry — ENABLED modules only; flag-gated features filtered.
 * Super Admin never appears here.
 */
@Controller('api/v1/me')
@UseGuards(SessionGuard)
export class MeRegistryController {
  constructor(
    private readonly registry: MeRegistryService,
    private readonly fieldAcl: MeFieldAclService,
  ) {}

  @Get('registry')
  async getRegistry(@CurrentUser() user: { id: string }, @Req() req: Request) {
    return this.registry.buildForUser(
      user.id,
      req.headers,
      (req.cookies ?? {}) as Record<string, string | undefined>,
    );
  }

  /** Field ACL for chrome — wage/amounts. UI hides; evaluate() still refuses. */
  @Get('field-acl')
  async getFieldAcl(@CurrentUser() user: { id: string }, @Req() req: Request) {
    return this.fieldAcl.buildForUser(
      user.id,
      req.headers,
      (req.cookies ?? {}) as Record<string, string | undefined>,
    );
  }
}
