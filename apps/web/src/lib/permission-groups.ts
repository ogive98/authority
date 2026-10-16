/** Groupement du catalogue de permissions par fonctionnalité (préfixe avant le 1er point). */

export const PERMISSION_MODULE_LABELS: Record<string, string> = {
  platform: "Plateforme",
  identity: "Identité & sécurité",
  org: "Organisation",
  license: "Licence",
  settings: "Préférences",
  thunder: "Thunder Core",
  system_monitoring: "Monitoring système",
  hr: "RH",
  products: "Produits",
  master_data: "Données de référence",
  customers: "Clients",
  suppliers: "Fournisseurs",
  fleet: "Flotte",
  maintenance: "Maintenance",
  inventory: "Stock",
  sales: "Ventes",
  delivery: "Livraison",
  finance: "Finance",
  tax: "Taxes",
  documents: "Documents",
  automation: "Automatisation",
  forge: "Forge",
  accounting: "Comptabilité",
  repair: "Repair",
  backup: "Sauvegarde",
  production: "Production",
  analytics: "Analytics",
  customer_portal: "Portail client",
  employee_portal: "Portail salarié",
  attendance: "Présence",
  procurement: "Achats",
  bom: "Recettes (BOM)",
  costing: "Coûts de revient",
  quality: "Qualité",
};

export type PermissionGroup = {
  moduleKey: string;
  label: string;
  keys: string[];
};

export function groupPermissionsByModule(catalog: string[]): PermissionGroup[] {
  const map = new Map<string, string[]>();
  for (const key of catalog) {
    const dot = key.indexOf(".");
    const moduleKey = dot > 0 ? key.slice(0, dot) : key;
    const list = map.get(moduleKey);
    if (list) list.push(key);
    else map.set(moduleKey, [key]);
  }
  return [...map.entries()].map(([moduleKey, keys]) => ({
    moduleKey,
    label: PERMISSION_MODULE_LABELS[moduleKey] ?? moduleKey,
    keys,
  }));
}
