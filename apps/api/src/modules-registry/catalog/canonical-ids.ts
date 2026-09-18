/**
 * Canonical ID aliases for Authority Index (D295).
 *
 * Technical identities stay the catalog keys (`sales`, `sales.confirm`,
 * `sales.order.created.v1`). Aliases (`mod.sales`, `cap.sales.confirm`)
 * are derived metadata — never a second identity store.
 */

const PREFIX = {
  module: 'mod.',
  feature: 'feat.',
  capability: 'cap.',
  command: 'cmd.',
  query: 'query.',
  event: 'event.',
  permission: 'perm.',
  configuration: 'cfg.',
  extension: 'ext.',
} as const;

export type CanonicalKind = keyof typeof PREFIX;

export function withPrefix(kind: CanonicalKind, technicalId: string): string {
  const prefix = PREFIX[kind];
  if (technicalId.startsWith(prefix)) {
    return technicalId;
  }
  return `${prefix}${technicalId}`;
}

export function canonicalModuleId(moduleKey: string): string {
  return withPrefix('module', moduleKey);
}

export function canonicalCapabilityId(capabilityKey: string): string {
  return withPrefix('capability', capabilityKey);
}

export function canonicalFeatureId(
  moduleKey: string,
  featureKey: string,
): string {
  const local = featureKey.startsWith(`${moduleKey}.`)
    ? featureKey
    : `${moduleKey}.${featureKey}`;
  return withPrefix('feature', local);
}

export function canonicalCommandId(commandKey: string): string {
  return withPrefix('command', commandKey);
}

export function canonicalQueryId(queryKey: string): string {
  return withPrefix('query', queryKey);
}

export function canonicalPermissionId(permissionKey: string): string {
  return withPrefix('permission', permissionKey);
}

export function canonicalConfigurationId(settingKey: string): string {
  return withPrefix('configuration', settingKey);
}

export function canonicalExtensionId(
  moduleKey: string,
  hookName: string,
): string {
  return withPrefix('extension', `${moduleKey}.${hookName}`);
}

/** Event technical id keeps `.vN`. Alias drops the version suffix. */
export function canonicalEventId(eventType: string): string {
  const stripped = eventType.replace(/\.v\d+$/, '');
  return withPrefix('event', stripped);
}

export function stripCanonicalPrefix(
  kind: CanonicalKind,
  canonicalId: string,
): string {
  const prefix = PREFIX[kind];
  return canonicalId.startsWith(prefix)
    ? canonicalId.slice(prefix.length)
    : canonicalId;
}
