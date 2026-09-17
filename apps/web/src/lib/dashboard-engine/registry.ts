import type { WidgetDefinition } from "./types";

/**
 * Central WidgetRegistry — modules register definitions; dashboards resolve by id.
 */
export class WidgetRegistry {
  private readonly byId = new Map<string, WidgetDefinition>();

  register(def: WidgetDefinition): void {
    if (!def.enabled) return;
    if (this.byId.has(def.id)) {
      throw new Error(`Widget already registered: ${def.id}`);
    }
    this.byId.set(def.id, def);
  }

  registerMany(defs: WidgetDefinition[]): void {
    for (const d of defs) this.register(d);
  }

  unregister(id: string): boolean {
    return this.byId.delete(id);
  }

  find(id: string): WidgetDefinition | undefined {
    return this.byId.get(id);
  }

  list(module?: string): WidgetDefinition[] {
    const all = [...this.byId.values()];
    return module ? all.filter((d) => d.module === module) : all;
  }

  validate(id: string, grants?: Set<string> | null): boolean {
    const def = this.byId.get(id);
    if (!def || !def.enabled) return false;
    if (!grants) return true;
    return def.permissions.every((p) => grants.has(p));
  }
}

export const globalWidgetRegistry = new WidgetRegistry();
