import type { ModuleManifest } from '../manifest.types';

/**
 * Repair / Thunder Control — scan · diagnose · repair · report (D079).
 * Ops module: no business mutation; registry-first scenarios.
 */
export const repairManifest: ModuleManifest = {
  id: 'repair',
  name: 'Repair',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'Thunder Control Repair — scan, diagnostic, allowlisted repair, reporting',
  capabilities: [
    {
      key: 'repair.dashboard.read',
      moduleId: 'repair',
      version: '1',
      description: 'Read Repair dashboard and health',
      permissionKey: 'repair.read',
      riskLevel: 'low',
    },
    {
      key: 'repair.scan',
      moduleId: 'repair',
      version: '1',
      description: 'Run diagnostic scans',
      permissionKey: 'repair.scan',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'repair.plan',
      moduleId: 'repair',
      version: '1',
      description: 'Build repair plans / dry-run',
      permissionKey: 'repair.scan',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'repair.execute',
      moduleId: 'repair',
      version: '1',
      description: 'Execute allowlisted SAFE/LOW repairs after approval',
      permissionKey: 'repair.execute',
      riskLevel: 'high',
      requiresAudit: true,
      requiresIdempotency: true,
    },
    {
      key: 'repair.reset',
      moduleId: 'repair',
      version: '1',
      description: 'Reset preview / execute (restricted)',
      permissionKey: 'repair.reset',
      riskLevel: 'high',
      requiresAudit: true,
    },
    {
      key: 'repair.report',
      moduleId: 'repair',
      version: '1',
      description: 'Central diagnostic reporting outbox',
      permissionKey: 'repair.read',
      riskLevel: 'low',
    },
  ],
  commands: [
    'repair.scan.run',
    'repair.plan.create',
    'repair.execute',
    'repair.rollback',
    'repair.reset.preview',
    'repair.reset.execute',
    'repair.report.flush',
  ],
  queries: [
    'repair.dashboard',
    'repair.health',
    'repair.findings.list',
    'repair.incidents.list',
    'repair.executions.list',
    'repair.reporting.status',
  ],
  permissions: [
    'repair.read',
    'repair.scan',
    'repair.execute',
    'repair.reset',
  ],
  publishedEvents: [
    'repair.scan.started.v1',
    'repair.scan.completed.v1',
    'repair.finding.detected.v1',
    'repair.plan.created.v1',
    'repair.started.v1',
    'repair.completed.v1',
    'repair.failed.v1',
    'repair.rollback.completed.v1',
    'repair.report.queued.v1',
  ],
  consumedEvents: [],
  dependencies: ['platform', 'organization', 'monitoring'],
  healthChecks: ['repair.kernel'],
  navigationEntries: [
    {
      id: 'repair-console',
      label: 'Repair',
      href: '/super-admin/repair',
    },
  ],
};
