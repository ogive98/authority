import type { ModuleManifest } from '../manifest.types';

export const bomManifest: ModuleManifest = {
  id: 'bom',
  name: 'Nomenclatures',
  version: '1.0.0',
  apiVersion: '1',
  description:
    'Nomenclatures V0 — recettes de production (ingrédients, pertes, versions, activation) (D325)',
  capabilities: [
    {
      key: 'bom.read',
      moduleId: 'bom',
      version: '1',
      description: 'List and read BOM recipes and lines',
      permissionKey: 'bom.read',
      riskLevel: 'low',
    },
    {
      key: 'bom.write',
      moduleId: 'bom',
      version: '1',
      description: 'Create recipes and add lines',
      permissionKey: 'bom.write',
      riskLevel: 'medium',
      requiresAudit: true,
    },
    {
      key: 'bom.activate',
      moduleId: 'bom',
      version: '1',
      description: 'Activate recipes (one active per product)',
      permissionKey: 'bom.activate',
      riskLevel: 'high',
      requiresAudit: true,
    },
  ],
  commands: [
    'bom.recipe.create',
    'bom.recipe.lines.add',
    'bom.recipe.activate',
  ],
  queries: [
    'bom.recipes.list',
    'bom.recipes.get',
  ],
  permissions: ['bom.read', 'bom.write', 'bom.activate'],
  dependencies: ['platform', 'organization', 'products'],
  publishedEvents: [],
  navigationEntries: [
    { id: 'bom', label: 'Nomenclatures', href: '/bom' },
  ],
};
