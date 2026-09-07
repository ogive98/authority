import { Injectable, Logger } from '@nestjs/common';
import type {
  ModuleHookContext,
  ModuleHookHealth,
  ModuleHooks,
  ModuleRuntimeContribution,
} from './module-hook.types';

@Injectable()
export class ModuleHookRegistry {
  private readonly logger = new Logger(ModuleHookRegistry.name);
  private readonly hooks = new Map<string, ModuleHooks>();
  private readonly registered = new Set<string>();
  private readonly lastRuns: Array<{
    at: string;
    action: 'register' | 'enable' | 'disable' | 'health';
    moduleKey: string;
    companyId?: string;
    ok: boolean;
    message?: string;
  }> = [];

  register(moduleKey: string, hooks: ModuleHooks): void {
    const existing = this.hooks.get(moduleKey);
    if (existing) {
      this.hooks.set(moduleKey, {
        ...existing,
        ...hooks,
        contribution: {
          ...existing.contribution,
          ...hooks.contribution,
          moduleKey,
          consumers: unique([
            ...(existing.contribution?.consumers ?? []),
            ...(hooks.contribution?.consumers ?? []),
          ]),
          jobTypes: unique([
            ...(existing.contribution?.jobTypes ?? []),
            ...(hooks.contribution?.jobTypes ?? []),
          ]),
          healthCheckIds: unique([
            ...(existing.contribution?.healthCheckIds ?? []),
            ...(hooks.contribution?.healthCheckIds ?? []),
          ]),
        },
        healthChecks: [
          ...(existing.healthChecks ?? []),
          ...(hooks.healthChecks ?? []),
        ],
        onRegister: chainOptional(existing.onRegister, hooks.onRegister),
        onEnable: chainOptional(existing.onEnable, hooks.onEnable),
        onDisable: chainOptional(existing.onDisable, hooks.onDisable),
      });
      return;
    }
    this.hooks.set(moduleKey, {
      ...hooks,
      contribution: hooks.contribution
        ? { ...hooks.contribution, moduleKey }
        : { moduleKey },
    });
  }

  listContributions(): ModuleRuntimeContribution[] {
    return [...this.hooks.values()]
      .map((h) => h.contribution)
      .filter((c): c is ModuleRuntimeContribution => Boolean(c))
      .sort((a, b) => a.moduleKey.localeCompare(b.moduleKey));
  }

  listLastRuns(take = 50) {
    return this.lastRuns.slice(-take);
  }

  has(moduleKey: string): boolean {
    return this.hooks.has(moduleKey);
  }

  async runRegisterAll(): Promise<void> {
    for (const [moduleKey, hooks] of this.hooks) {
      if (this.registered.has(moduleKey) || !hooks.onRegister) {
        continue;
      }
      try {
        await hooks.onRegister();
        this.registered.add(moduleKey);
        this.pushRun({
          action: 'register',
          moduleKey,
          ok: true,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'onRegister failed';
        this.logger.warn(`Module hook onRegister ${moduleKey}: ${message}`);
        this.pushRun({
          action: 'register',
          moduleKey,
          ok: false,
          message,
        });
        throw error;
      }
    }
  }

  async runEnable(ctx: ModuleHookContext): Promise<void> {
    const hooks = this.hooks.get(ctx.moduleKey);
    if (!hooks?.onEnable) {
      return;
    }
    try {
      await hooks.onEnable(ctx);
      this.pushRun({
        action: 'enable',
        moduleKey: ctx.moduleKey,
        companyId: ctx.companyId,
        ok: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'onEnable failed';
      this.logger.warn(
        `Module hook onEnable ${ctx.moduleKey}@${ctx.companyId}: ${message}`,
      );
      this.pushRun({
        action: 'enable',
        moduleKey: ctx.moduleKey,
        companyId: ctx.companyId,
        ok: false,
        message,
      });
      throw error;
    }
  }

  async runDisable(ctx: ModuleHookContext): Promise<void> {
    const hooks = this.hooks.get(ctx.moduleKey);
    if (!hooks?.onDisable) {
      return;
    }
    try {
      await hooks.onDisable(ctx);
      this.pushRun({
        action: 'disable',
        moduleKey: ctx.moduleKey,
        companyId: ctx.companyId,
        ok: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'onDisable failed';
      this.logger.warn(
        `Module hook onDisable ${ctx.moduleKey}@${ctx.companyId}: ${message}`,
      );
      this.pushRun({
        action: 'disable',
        moduleKey: ctx.moduleKey,
        companyId: ctx.companyId,
        ok: false,
        message,
      });
      throw error;
    }
  }

  async runHealthChecks(moduleKey?: string): Promise<ModuleHookHealth[]> {
    const entries = moduleKey
      ? ([[moduleKey, this.hooks.get(moduleKey)]] as const)
      : [...this.hooks.entries()];

    const results: ModuleHookHealth[] = [];
    for (const [key, hooks] of entries) {
      if (!hooks?.healthChecks?.length) {
        continue;
      }
      for (const check of hooks.healthChecks) {
        try {
          const result = await check();
          results.push(result);
          this.pushRun({
            action: 'health',
            moduleKey: key,
            ok: result.ok,
            message: result.message,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'healthCheck failed';
          results.push({
            ok: false,
            checkId: `${key}.health`,
            message,
          });
          this.pushRun({
            action: 'health',
            moduleKey: key,
            ok: false,
            message,
          });
        }
      }
    }
    return results;
  }

  private pushRun(entry: {
    action: 'register' | 'enable' | 'disable' | 'health';
    moduleKey: string;
    companyId?: string;
    ok: boolean;
    message?: string;
  }): void {
    this.lastRuns.push({
      ...entry,
      at: new Date().toISOString(),
    });
    if (this.lastRuns.length > 200) {
      this.lastRuns.splice(0, this.lastRuns.length - 200);
    }
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function chainOptional<T extends unknown[]>(
  a?: (...args: T) => void | Promise<void>,
  b?: (...args: T) => void | Promise<void>,
): ((...args: T) => Promise<void>) | undefined {
  if (!a && !b) {
    return undefined;
  }
  return async (...args: T) => {
    if (a) {
      await a(...args);
    }
    if (b) {
      await b(...args);
    }
  };
}
