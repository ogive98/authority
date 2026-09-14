import type { ModuleManifest } from '../manifest.types';

export const fleetManifest: ModuleManifest = {
  id: 'fleet',
  name: 'Flotte',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'Fleet Soft Glass — vehicles, assignment, carnet (vidange/pneus/carburant), usual driver (D257)',
  capabilities: [
    {
      key: 'fleet.manage',
      moduleId: 'fleet',
      version: '1',
      description: 'Create and update fleet vehicles and carnet',
      permissionKey: 'fleet.manage',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'fleet.assign',
      moduleId: 'fleet',
      version: '1',
      description: 'Assign vehicles to delivery rounds',
      permissionKey: 'fleet.assign',
      riskLevel: 'medium',
      requiresAudit: true,
    },
  ],
  commands: [
    'fleet.vehicle.create',
    'fleet.vehicle.patch',
    'fleet.vehicle.log.create',
    'fleet.assignment.create',
    'fleet.assignment.cancel',
    'fleet.assignment.copy_driver',
  ],
  queries: [
    'fleet.vehicles.list',
    'fleet.vehicle.get',
    'fleet.vehicle.logs',
    'fleet.assignments.list',
  ],
  permissions: ['fleet.manage', 'fleet.assign'],
  dependencies: ['platform', 'organization', 'delivery'],
  publishedEvents: [
    'fleet.vehicle.created.v1',
    'fleet.vehicle.updated.v1',
    'fleet.vehicle.log_created.v1',
    'fleet.assignment.created.v1',
    'fleet.assignment.cancelled.v1',
    'fleet.assignment.driver_copied.v1',
  ],
  navigationEntries: [
    { id: 'fleet-vehicles', label: 'Flotte', href: '/fleet' },
    { id: 'fleet-planning', label: 'Planning flotte', href: '/fleet?tab=planning' },
  ],
};
