export const AUDIT_ACTIONS = {
  identityUserUpdate: 'identity.user.update',
  identityUserInvite: 'identity.user.invite',
  identityUserReinvite: 'identity.user.reinvite',
  identityUserInviteAccept: 'identity.user.invite_accept',
  identityUserInviteAdminActivate: 'identity.user.invite_admin_activate',
  identityUserInviteEmailSent: 'identity.user.invite_email_sent',
  identityUserInviteEmailFailed: 'identity.user.invite_email_failed',
  identityDevicePair: 'identity.device.pair',
  identityDeviceClaim: 'identity.device.claim',
  identityDeviceRevoke: 'identity.device.revoke',
  organizationSiteCreate: 'organization.site.create',
  settingsValueUpdate: 'settings.value.update',
  settingsExpertiseValidate: 'settings.expertise.validate',
  settingsMailTestSent: 'settings.mail.test_sent',
  settingsMailTestFailed: 'settings.mail.test_failed',
  moduleEnable: 'module.enable',
  moduleDisable: 'module.disable',
  thunderBreakerForceOpen: 'thunder.breaker.force_open',
  thunderBreakerReset: 'thunder.breaker.reset',
  thunderRecoApply: 'thunder.recommendation.apply',
} as const;

export const OUTBOX_EVENT_TYPES = {
  identityUserUpdated: 'identity.user.updated.v1',
  platformNumberAllocated: 'platform.number.allocated.v1',
  platformFileUploaded: 'platform.file.uploaded.v1',
  organizationSiteCreated: 'organization.site.created.v1',
  settingsValueUpdated: 'settings.value.updated.v1',
  settingsExpertiseValidated: 'settings.expertise.validated.v1',
  moduleEnabled: 'module.enabled.v1',
  moduleDisabled: 'module.disabled.v1',
} as const;

export const AUDIT_ENTITY_TYPES = {
  iamUser: 'iam_user',
  iamDevice: 'iam_device',
  orgSite: 'org_site',
  setValue: 'set_value',
  setExpertise: 'set_expertise',
  modModuleState: 'mod_module_state',
  thunderCircuitBreaker: 'thunder_circuit_breaker',
  thuRecommendation: 'thu_recommendation',
} as const;
