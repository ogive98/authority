import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../identity/session.guard';
import { CapabilityGuard } from './capability.guard';
import { ModuleGuard } from './module.guard';
import { RequireCapability, RequireModule } from './modules.decorators';

/** Liveness surface kept separate so CAP e2e are not coupled to Tenancy/Permission. */
@Controller('api/v1/sales')
@UseGuards(SessionGuard, ModuleGuard, CapabilityGuard)
@RequireModule('sales')
export class SalesSurfaceController {
  @Get('ping')
  @RequireCapability('sales.ping')
  ping() {
    return { status: 'ok', module: 'sales', capability: 'sales.ping' };
  }
}
