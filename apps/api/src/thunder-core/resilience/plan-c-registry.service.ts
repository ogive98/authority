import { Injectable } from '@nestjs/common';
import type { PlanCContext, PlanCHandler } from './circuit-breaker.types';

@Injectable()
export class PlanCRegistryService {
  private readonly handlers = new Map<string, PlanCHandler>();

  constructor() {
    this.register('external_api_stub', (context) =>
      Promise.resolve({
        mode: 'plan_c',
        dependencyKey: context.dependencyKey,
        message: 'Dependency unavailable — degraded stub path',
      }),
    );
  }

  register(dependencyKey: string, handler: PlanCHandler): void {
    this.handlers.set(dependencyKey, handler);
  }

  registerPlanC(dependencyKey: string, handler: PlanCHandler): void {
    this.register(dependencyKey, handler);
  }

  async execute(
    dependencyKey: string,
    context: PlanCContext,
  ): Promise<Record<string, unknown>> {
    const handler = this.handlers.get(dependencyKey);
    if (!handler) {
      return {
        mode: 'plan_c',
        dependencyKey,
        message: 'No Plan C handler registered',
      };
    }
    return handler(context);
  }
}
