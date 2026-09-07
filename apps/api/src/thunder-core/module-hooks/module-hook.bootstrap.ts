import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleHookRegistry } from '../../modules-registry/catalog/module-hook.registry';

/** After all registrars OnModuleInit — run process onRegister hooks once. */
@Injectable()
export class ModuleHookBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(ModuleHookBootstrap.name);

  constructor(private readonly hooks: ModuleHookRegistry) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.hooks.runRegisterAll();
    this.logger.log(
      `Module hooks ready: ${this.hooks.listContributions().length} contributions`,
    );
  }
}
