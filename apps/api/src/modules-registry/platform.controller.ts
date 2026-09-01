import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../identity/session.guard';
import { FlagGuard } from './flag.guard';
import { ModuleGuard } from './module.guard';
import { FLAG_KEYS } from './modules.constants';
import { RequireFlag, RequireModule } from './modules.decorators';

@Controller('api/v1/platform')
@UseGuards(SessionGuard, ModuleGuard, FlagGuard)
@RequireModule('platform')
export class PlatformController {
  @Get('search')
  @RequireFlag(FLAG_KEYS.platformSearch)
  search() {
    return { hits: [] as const };
  }
}
