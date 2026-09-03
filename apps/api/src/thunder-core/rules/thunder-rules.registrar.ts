import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConsumerRegistryService } from '../events/consumer-registry.service';
import { RuleEngineService } from './rule-engine.service';

@Injectable()
export class ThunderRulesRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ConsumerRegistryService,
    private readonly engine: RuleEngineService,
  ) {}

  onModuleInit(): void {
    this.registry.register('thunder.rules', (envelope) =>
      this.engine.handleEvent(envelope),
    );
  }
}
