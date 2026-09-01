import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleRegistryService } from './module-registry.service';
import { moduleKeyForFlag } from './modules.constants';

@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRegistry: ModuleRegistryService,
  ) {}

  async isEnabled(companyId: string, flagKey: string): Promise<boolean> {
    const moduleKey = moduleKeyForFlag(flagKey);
    if (!(await this.moduleRegistry.isEnabled(companyId, moduleKey))) {
      return false;
    }

    const flag = await this.prisma.modFlag.findUnique({
      where: {
        companyId_flagKey: { companyId, flagKey },
      },
    });
    return flag?.enabled === true;
  }

  async listFlags(companyId: string) {
    return this.prisma.modFlag.findMany({
      where: { companyId },
      orderBy: { flagKey: 'asc' },
    });
  }
}
