export const AUDIT_ACTIONS = {
  identityUserUpdate: 'identity.user.update',
  organizationSiteCreate: 'organization.site.create',
  settingsValueUpdate: 'settings.value.update',
  moduleEnable: 'module.enable',
  moduleDisable: 'module.disable',
  thunderBreakerForceOpen: 'thunder.breaker.force_open',
  thunderBreakerReset: 'thunder.breaker.reset',
} as const;

export const OUTBOX_EVENT_TYPES = {
  identityUserUpdated: 'identity.user.updated.v1',
  platformNumberAllocated: 'platform.number.allocated.v1',
  platformFileUploaded: 'platform.file.uploaded.v1',
  organizationSiteCreated: 'organization.site.created.v1',
  settingsValueUpdated: 'settings.value.updated.v1',
  moduleEnabled: 'module.enabled.v1',
  moduleDisabled: 'module.disabled.v1',
} as const;

export const AUDIT_ENTITY_TYPES = {
  iamUser: 'iam_user',
  orgSite: 'org_site',
  setValue: 'set_value',
  modModuleState: 'mod_module_state',
  thunderCircuitBreaker: 'thunder_circuit_breaker',
} as const;
