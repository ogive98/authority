import type { ModuleManifest } from '../manifest.types';

/**
 * Attendance leave V0 (D218) — request / approve absences.
 * Never invent Tunisian leave quotas or Prefs day balances.
 */
export const attendanceManifest: ModuleManifest = {
  id: 'attendance',
  name: 'Attendance',
  version: '0.1.0',
  apiVersion: '1',
  description:
    'Attendance domain — leave API (PAID|UNPAID|OTHER); AUTHORITY UI under HR Congés',
  capabilities: [
    {
      key: 'attendance.self',
      moduleId: 'attendance',
      version: '1',
      description: 'Request and view own leave absences',
      permissionKey: 'attendance.self',
      riskLevel: 'low',
    },
    {
      key: 'attendance.manage',
      moduleId: 'attendance',
      version: '1',
      description: 'Create and manage absences for employees',
      permissionKey: 'attendance.manage',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'attendance.approve',
      moduleId: 'attendance',
      version: '1',
      description: 'Approve or reject leave requests',
      permissionKey: 'attendance.approve',
      riskLevel: 'medium',
      requiresAudit: true,
    },
  ],
  commands: [
    'attendance.absence.create',
    'attendance.absence.approve',
    'attendance.absence.reject',
    'attendance.absence.cancel',
    'attendance.rh_event.create',
  ],
  queries: [
    'attendance.absences.list',
    'attendance.absence.get',
    'attendance.calendar.get',
  ],
  permissions: [
    'attendance.self',
    'attendance.manage',
    'attendance.approve',
  ],
  dependencies: ['platform', 'organization', 'identity', 'hr'],
  publishedEvents: [
    'attendance.absence.requested.v1',
    'attendance.absence.approved.v1',
    'attendance.absence.rejected.v1',
    'attendance.absence.cancelled.v1',
    'attendance.rh_event.created.v1',
  ],
  // Domain module only — AUTHORITY nav lives under `hr` (Congés tab). Empty =
  // hide from métier rail (D111 / D218 UX: not a parallel module icon).
  navigationEntries: [],
};
