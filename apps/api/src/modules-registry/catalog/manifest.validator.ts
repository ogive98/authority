import {
  CAPABILITY_DEF_KEYS,
  CAPABILITY_RISK_LEVELS,
  MODULE_MANIFEST_KEYS,
  type CapabilityDef,
  type ModuleManifest,
} from './manifest.types';

export const CATALOG_ERROR_CODES = {
  INVALID_MANIFEST: 'CATALOG.INVALID_MANIFEST',
  DUPLICATE_MODULE: 'CATALOG.DUPLICATE_MODULE',
  DUPLICATE_CAPABILITY: 'CATALOG.DUPLICATE_CAPABILITY',
  UNKNOWN_DEPENDENCY: 'CATALOG.UNKNOWN_DEPENDENCY',
} as const;

export class CatalogValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CatalogValidationError';
  }
}

const MANIFEST_KEY_SET = new Set<string>(MODULE_MANIFEST_KEYS);
const CAPABILITY_KEY_SET = new Set<string>(CAPABILITY_DEF_KEYS);
const RISK_SET = new Set<string>(CAPABILITY_RISK_LEVELS);

export function assertModuleManifest(input: unknown): ModuleManifest {
  if (!isPlainObject(input)) {
    throw new CatalogValidationError(
      CATALOG_ERROR_CODES.INVALID_MANIFEST,
      'Manifest must be a plain object',
    );
  }

  assertOnlyKeys(input, MANIFEST_KEY_SET, 'manifest');

  const id = requireNonEmptyString(input.id, 'id');
  const name = requireNonEmptyString(input.name, 'name');
  const version = requireNonEmptyString(input.version, 'version');
  const apiVersion = requireNonEmptyString(input.apiVersion, 'apiVersion');

  if (!Array.isArray(input.capabilities)) {
    throw new CatalogValidationError(
      CATALOG_ERROR_CODES.INVALID_MANIFEST,
      'capabilities must be an array',
    );
  }

  const capabilities = input.capabilities.map((cap, index) =>
    assertCapabilityDef(cap, id, index),
  );

  const manifest: ModuleManifest = {
    id,
    name,
    version,
    apiVersion,
    capabilities,
  };

  if (input.description !== undefined) {
    manifest.description = requireNonEmptyString(
      input.description,
      'description',
    );
  }
  if (input.commands !== undefined) {
    manifest.commands = assertStringArray(input.commands, 'commands');
  }
  if (input.queries !== undefined) {
    manifest.queries = assertStringArray(input.queries, 'queries');
  }
  if (input.publishedEvents !== undefined) {
    manifest.publishedEvents = assertStringArray(
      input.publishedEvents,
      'publishedEvents',
    );
  }
  if (input.consumedEvents !== undefined) {
    manifest.consumedEvents = assertStringArray(
      input.consumedEvents,
      'consumedEvents',
    );
  }
  if (input.permissions !== undefined) {
    manifest.permissions = assertStringArray(input.permissions, 'permissions');
  }
  if (input.dependencies !== undefined) {
    manifest.dependencies = assertStringArray(
      input.dependencies,
      'dependencies',
    );
  }
  if (input.optionalDependencies !== undefined) {
    manifest.optionalDependencies = assertStringArray(
      input.optionalDependencies,
      'optionalDependencies',
    );
  }
  if (input.settingsDefinitions !== undefined) {
    manifest.settingsDefinitions = assertObjectArray(
      input.settingsDefinitions,
      'settingsDefinitions',
    );
  }
  if (input.navigationEntries !== undefined) {
    manifest.navigationEntries = assertObjectArray(
      input.navigationEntries,
      'navigationEntries',
    );
  }
  if (input.dashboardWidgets !== undefined) {
    manifest.dashboardWidgets = assertObjectArray(
      input.dashboardWidgets,
      'dashboardWidgets',
    );
  }
  if (input.healthChecks !== undefined) {
    manifest.healthChecks = assertStringArray(
      input.healthChecks,
      'healthChecks',
    );
  }
  if (input.migrationsVersion !== undefined) {
    manifest.migrationsVersion = requireNonEmptyString(
      input.migrationsVersion,
      'migrationsVersion',
    );
  }
  if (input.compatibility !== undefined) {
    manifest.compatibility = assertCompatibility(input.compatibility);
  }

  return manifest;
}

export function assertCapabilityDef(
  input: unknown,
  expectedModuleId: string,
  index: number,
): CapabilityDef {
  if (!isPlainObject(input)) {
    throw new CatalogValidationError(
      CATALOG_ERROR_CODES.INVALID_MANIFEST,
      `capabilities[${index}] must be a plain object`,
    );
  }

  assertOnlyKeys(input, CAPABILITY_KEY_SET, `capabilities[${index}]`);

  const key = requireNonEmptyString(input.key, `capabilities[${index}].key`);
  const moduleId = requireNonEmptyString(
    input.moduleId,
    `capabilities[${index}].moduleId`,
  );
  const version = requireNonEmptyString(
    input.version,
    `capabilities[${index}].version`,
  );

  if (moduleId !== expectedModuleId) {
    throw new CatalogValidationError(
      CATALOG_ERROR_CODES.INVALID_MANIFEST,
      `capabilities[${index}].moduleId must equal manifest id (${expectedModuleId})`,
    );
  }

  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(key)) {
    throw new CatalogValidationError(
      CATALOG_ERROR_CODES.INVALID_MANIFEST,
      `capabilities[${index}].key must be dotted lowercase (got ${key})`,
    );
  }

  const cap: CapabilityDef = { key, moduleId, version };

  if (input.description !== undefined) {
    cap.description = requireNonEmptyString(
      input.description,
      `capabilities[${index}].description`,
    );
  }
  if (input.permissionKey !== undefined) {
    cap.permissionKey = requireNonEmptyString(
      input.permissionKey,
      `capabilities[${index}].permissionKey`,
    );
  }
  if (input.riskLevel !== undefined) {
    if (typeof input.riskLevel !== 'string' || !RISK_SET.has(input.riskLevel)) {
      throw new CatalogValidationError(
        CATALOG_ERROR_CODES.INVALID_MANIFEST,
        `capabilities[${index}].riskLevel must be low|medium|high`,
      );
    }
    cap.riskLevel = input.riskLevel as CapabilityDef['riskLevel'];
  }
  if (input.timeoutMs !== undefined) {
    if (
      typeof input.timeoutMs !== 'number' ||
      !Number.isFinite(input.timeoutMs) ||
      input.timeoutMs <= 0
    ) {
      throw new CatalogValidationError(
        CATALOG_ERROR_CODES.INVALID_MANIFEST,
        `capabilities[${index}].timeoutMs must be a positive number`,
      );
    }
    cap.timeoutMs = input.timeoutMs;
  }
  if (input.requiresIdempotency !== undefined) {
    if (typeof input.requiresIdempotency !== 'boolean') {
      throw new CatalogValidationError(
        CATALOG_ERROR_CODES.INVALID_MANIFEST,
        `capabilities[${index}].requiresIdempotency must be boolean`,
      );
    }
    cap.requiresIdempotency = input.requiresIdempotency;
  }
  if (input.requiresAudit !== undefined) {
    if (typeof input.requiresAudit !== 'boolean') {
      throw new CatalogValidationError(
        CATALOG_ERROR_CODES.INVALID_MANIFEST,
        `capabilities[${index}].requiresAudit must be boolean`,
      );
    }
    cap.requiresAudit = input.requiresAudit;
  }

  return cap;
}

export function assertCatalogIntegrity(manifests: ModuleManifest[]): void {
  const moduleIds = new Set<string>();
  const capabilityKeys = new Set<string>();

  for (const manifest of manifests) {
    if (moduleIds.has(manifest.id)) {
      throw new CatalogValidationError(
        CATALOG_ERROR_CODES.DUPLICATE_MODULE,
        `Duplicate module id: ${manifest.id}`,
      );
    }
    moduleIds.add(manifest.id);

    for (const cap of manifest.capabilities) {
      if (capabilityKeys.has(cap.key)) {
        throw new CatalogValidationError(
          CATALOG_ERROR_CODES.DUPLICATE_CAPABILITY,
          `Duplicate capability key: ${cap.key}`,
        );
      }
      capabilityKeys.add(cap.key);
    }
  }

  for (const manifest of manifests) {
    for (const dep of manifest.dependencies ?? []) {
      if (!moduleIds.has(dep)) {
        throw new CatalogValidationError(
          CATALOG_ERROR_CODES.UNKNOWN_DEPENDENCY,
          `Module ${manifest.id} depends on unknown module ${dep}`,
        );
      }
    }
    for (const dep of manifest.optionalDependencies ?? []) {
      if (!moduleIds.has(dep)) {
        throw new CatalogValidationError(
          CATALOG_ERROR_CODES.UNKNOWN_DEPENDENCY,
          `Module ${manifest.id} optionally depends on unknown module ${dep}`,
        );
      }
    }
  }
}

function assertOnlyKeys(
  input: Record<string, unknown>,
  allowed: Set<string>,
  label: string,
): void {
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      throw new CatalogValidationError(
        CATALOG_ERROR_CODES.INVALID_MANIFEST,
        `Unknown ${label} property: ${key}`,
      );
    }
  }
}

function assertStringArray(input: unknown, field: string): string[] {
  if (!Array.isArray(input)) {
    throw new CatalogValidationError(
      CATALOG_ERROR_CODES.INVALID_MANIFEST,
      `${field} must be an array of strings`,
    );
  }
  return input.map((value, index) =>
    requireNonEmptyString(value, `${field}[${index}]`),
  );
}

function assertObjectArray(
  input: unknown,
  field: string,
): Record<string, unknown>[] {
  if (!Array.isArray(input)) {
    throw new CatalogValidationError(
      CATALOG_ERROR_CODES.INVALID_MANIFEST,
      `${field} must be an array of objects`,
    );
  }
  return input.map((value, index) => {
    if (!isPlainObject(value)) {
      throw new CatalogValidationError(
        CATALOG_ERROR_CODES.INVALID_MANIFEST,
        `${field}[${index}] must be a plain object`,
      );
    }
    return value;
  });
}

function assertCompatibility(
  input: unknown,
): NonNullable<ModuleManifest['compatibility']> {
  if (!isPlainObject(input)) {
    throw new CatalogValidationError(
      CATALOG_ERROR_CODES.INVALID_MANIFEST,
      'compatibility must be a plain object',
    );
  }
  const allowed = new Set(['minApiVersion', 'maxApiVersion']);
  assertOnlyKeys(input, allowed, 'compatibility');
  const out: NonNullable<ModuleManifest['compatibility']> = {};
  if (input.minApiVersion !== undefined) {
    out.minApiVersion = requireNonEmptyString(
      input.minApiVersion,
      'compatibility.minApiVersion',
    );
  }
  if (input.maxApiVersion !== undefined) {
    out.maxApiVersion = requireNonEmptyString(
      input.maxApiVersion,
      'compatibility.maxApiVersion',
    );
  }
  return out;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CatalogValidationError(
      CATALOG_ERROR_CODES.INVALID_MANIFEST,
      `${field} must be a non-empty string`,
    );
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
