export type ModuleHookContext = {
  companyId: string;
  moduleKey: string;
  correlationId?: string;
  actorUserId?: string;
};

export type ModuleHookHealth = {
  ok: boolean;
  checkId: string;
  message?: string;
  details?: Record<string, unknown>;
};

/**
 * Process-level contribution a module (or Thunder facet) declares at boot.
 * Terrain for Marketplace / Control — not a second plugin runtime yet.
 */
export type ModuleRuntimeContribution = {
  moduleKey: string;
  consumers?: string[];
  jobTypes?: string[];
  healthCheckIds?: string[];
  rulesPack?: string;
  description?: string;
};

export type ModuleHooks = {
  contribution?: ModuleRuntimeContribution;
  /** Process boot — register consumers/jobs/rules (idempotent). */
  onRegister?: () => void | Promise<void>;
  /** After company ENABLE committed. */
  onEnable?: (ctx: ModuleHookContext) => void | Promise<void>;
  /** After company DISABLE committed. */
  onDisable?: (ctx: ModuleHookContext) => void | Promise<void>;
  /** Optional health probes (aggregated on demand). */
  healthChecks?: Array<() => ModuleHookHealth | Promise<ModuleHookHealth>>;
};
