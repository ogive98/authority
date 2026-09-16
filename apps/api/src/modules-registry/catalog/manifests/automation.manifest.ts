import type { ModuleManifest } from '../manifest.types';

export const automationManifest: ModuleManifest = {
  id: 'automation',
  name: 'Automation',
  version: '0.1.0',
  apiVersion: '1',
  description:
    'ASSISTED / REQUIRES_APPROVAL automation profiles — human-gated suggestions; Thunder event→suggest (D245/D289); FULL_AUTO forbidden',
  capabilities: [
    {
      key: 'automation.profiles.read',
      moduleId: 'automation',
      version: '1',
      description: 'List and read automation profiles and run logs',
      permissionKey: 'automation.read',
      riskLevel: 'low',
    },
    {
      key: 'automation.profiles.write',
      moduleId: 'automation',
      version: '1',
      description: 'Create/update profiles and trigger assisted runs',
      permissionKey: 'automation.write',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'automation.runs.approve',
      moduleId: 'automation',
      version: '1',
      description: 'Approve or reject pending automation runs',
      permissionKey: 'automation.approve',
      riskLevel: 'medium',
      requiresAudit: true,
    },
  ],
  commands: [
    'automation.profile.create',
    'automation.profile.update',
    'automation.profile.run',
    'automation.run.approve',
    'automation.run.reject',
  ],
  queries: [
    'automation.catalog',
    'automation.profiles.list',
    'automation.profiles.get',
    'automation.runs.list',
    'automation.runs.get',
  ],
  permissions: [
    'automation.read',
    'automation.write',
    'automation.approve',
  ],
  dependencies: ['platform', 'organization'],
  publishedEvents: [
    'automation.profile.changed.v1',
    'automation.run.created.v1',
    'automation.run.reviewed.v1',
  ],
  navigationEntries: [
    { id: 'automation-home', label: 'Automatisation', href: '/automation' },
  ],
};
