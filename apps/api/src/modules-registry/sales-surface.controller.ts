import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../identity/session.guard';
import { ModuleGuard } from './module.guard';
import { RequireModule } from './modules.decorators';

@Controller('api/v1/sales')
@UseGuards(SessionGuard, ModuleGuard)
@RequireModule('sales')
export class SalesSurfaceController {
  @Get('ping')
  ping() {
    return { status: 'ok', module: 'sales' };
  }
}
