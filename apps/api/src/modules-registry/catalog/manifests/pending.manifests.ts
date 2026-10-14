import type { ModuleManifest } from '../manifest.types';

/**
 * E1 — immatriculation des modules spécifiés mais absents du registre.
 *
 * Un module non listé dans `BUSINESS_MODULE_KEYS` ne peut être ni activé
 * (super-admin), ni gaté (`@RequireModule`), ni licensié, ni flaggé
 * (`FeatureFlagService.isEnabled` exige d'abord que le module parent soit ENABLED).
 * Ces entrées décrivent donc le périmètre à venir ; le code réel arrive par
 * étape (E2 achats, E3 recettes/coûts, E4 qualité/HACCP/traçabilité,
 * E5 impression/étiquettes, E6 encaissement, E7 audit, E8 workflows & co).
 *
 * Sans état `ModModuleState` en base un module est DISABLED (`isEnabled` renvoie
 * false quand la ligne manque) : ces entrées n'exposent donc aucun écran vide.
 * Quand le code d'un module livré, remplacer son entrée par un vrai manifeste
 * (capabilities réelles, commands, events) comme les autres fichiers du dossier.
 */
type PendingDef = {
  id: string;
  name: string;
  /** Ce que le module promet — visible dans /api/v1/capabilities. */
  description: string;
  dependencies: string[];
};

const PENDING: readonly PendingDef[] = [
  {
    id: 'print',
    name: 'Print Engine',
    description: 'Impression: print-jobs, spool, reprint, agent physique (E5)',
    dependencies: ['platform', 'documents'],
  },
  {
    id: 'cash',
    name: 'Cash Collection',
    description: 'Encaissement: collectes livreur, clôtures caisse, écarts (E6)',
    dependencies: ['platform', 'organization', 'finance', 'delivery'],
  },
  {
    id: 'audit',
    name: 'Audit',
    description: "Audit: recherche, filtres, export (l'append est déjà écrit)",
    dependencies: ['platform', 'identity'],
  },
  {
    id: 'license',
    name: 'License',
    description: 'Licence: limites, grâce et mode hors-ligne côté utilisateur',
    dependencies: ['platform', 'organization'],
  },
  {
    id: 'workflows',
    name: 'Workflows',
    description: 'Workflows: définitions, instances, tâches, inbox (E8)',
    dependencies: ['platform', 'identity'],
  },
  {
    id: 'alerts',
    name: 'Alerts',
    description: 'Alertes: règles, snooze, destinations (E8)',
    dependencies: ['platform', 'notifications'],
  },
  {
    id: 'dashboards',
    name: 'Dashboards',
    description: 'Dashboards: persistance, partage, rôle par défaut (E8)',
    dependencies: ['platform', 'settings'],
  },
  {
    id: 'integrations',
    name: 'Integrations',
    description: 'Intégrations: clés API, webhooks sortants (E8)',
    dependencies: ['platform', 'identity'],
  },
  {
    id: 'import_export',
    name: 'Import Export',
    description: 'Import/export génériques: dry run, mappings, xlsx (E8)',
    dependencies: ['platform', 'master_data'],
  },
  {
    id: 'reporting',
    name: 'Reporting',
    description: 'Reporting: catalogue de rapports, runs, exports (E8)',
    dependencies: ['platform', 'settings'],
  },
  {
    id: 'pricing',
    name: 'Pricing',
    description: 'Tarification: listes de prix, conditions, historique',
    dependencies: ['platform', 'products', 'customers'],
  },
  {
    id: 'devices',
    name: 'Devices',
    description: 'Postes: mesures balance/scan/pointage (pairing déjà dans identity)',
    dependencies: ['platform', 'identity'],
  },
  {
    id: 'help',
    name: 'Help Center',
    description: 'Aide: articles stockés et éditables (front statique livré)',
    dependencies: ['platform', 'settings'],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Notifications: préférences serveur, canaux, digest (in-app livré)',
    dependencies: ['platform', 'identity'],
  },
  {
    id: 'demo',
    name: 'Demo',
    description: 'Démo: reset et isolation de la base de démonstration',
    dependencies: ['platform', 'organization'],
  },
];

export const PENDING_MODULE_MANIFESTS: readonly ModuleManifest[] = PENDING.map(
  (def) => ({
    id: def.id,
    name: def.name,
    version: '0.0.0',
    apiVersion: '1',
    description: def.description,
    capabilities: [
      {
        key: `${def.id}.discover`,
        moduleId: def.id,
        version: '1',
        description: `${def.name} discovery placeholder`,
        riskLevel: 'low',
      },
    ],
    commands: [],
    queries: [],
    permissions: [],
    dependencies: def.dependencies,
  }),
);
