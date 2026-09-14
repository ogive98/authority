import type { ShellLocale } from "@/stores/locale-store";
import type { MeRegistry } from "@/lib/registry";

/**
 * Registry label overlays (D166) — FR stays API/manifest source of truth;
 * IT is a client overlay by module key / feature id (no hardcode of nav structure).
 */

export const MODULE_LABELS_IT: Record<string, string> = {
  home: "Cruscotto",
  sales: "Vendite",
  customers: "Clienti",
  suppliers: "Fornitori",
  inventory: "Scorte",
  delivery: "Consegne",
  finance: "Finanza",
  tax: "Fiscalità",
  hr: "Risorse umane",
  accounting: "Contabilità",
  repair: "Riparazione",
  documents: "Documenti",
  products: "Prodotti",
  identity: "Identità",
  settings: "Impostazioni",
  production: "Produzione",
  platform: "Piattaforma",
  portals: "Portali",
  automation: "Automazione",
  attendance: "Presenze",
  payroll: "Paghe",
  monitoring: "Monitoraggio",
};

export const FEATURE_LABELS_IT: Record<string, string> = {
  dashboard: "Panoramica",
  preview: "Anteprime schermo",
  tasks: "Attività",
  alerts: "Avvisi",
  orders: "Ordini",
  "sales-form": "Presa ordine",
  customers: "Clienti",
  suppliers: "Fornitori",
  salubrita: "Certificato di salubrità",
  lots: "Lotti",
  inventory: "Inventario",
  stock: "Inventario",
  shipments: "Giri di consegna",
  "open-items": "Crediti",
  invoices: "Fatture",
  payments: "Incassi",
  instruments: "Strumenti di pagamento",
  promises: "Promesse di pagamento",
  "payment-declarations": "Dichiarazioni portale",
  "tax-catalog": "Fiscalità / IVA",
  "tax-expertise": "Expertise fiscale (Prefs)",
  "hr-employees": "Dipendenti",
  "hr-job-titles": "Mansioni",
  "hr-bulletins": "Buste paga",
  "hr-conges": "Congedi",
  gl: "Libro mastro",
  "repair-home": "Riparazione",
  "repair-diagnostics": "Diagnostica",
  library: "Documenti",
  catalogue: "Catalogo",
  account: "Il mio account",
  users: "Utenti",
  preferences: "Preferenze",
  expertise: "Expertise legale",
  of: "Ordini di produzione",
  banking: "Banca",
  "ap-bills": "Fatture fornitori",
  "credit-notes": "Note di credito",
  "automation-home": "Automazione",
  attendance: "Presenze",
  bulletins: "Buste paga",
  conges: "Congedi",
  "hr-kinds": "Tipi documento",
  templates: "Modelli",
};

/** Overlay IT names/labels; FR passthrough. Structure unchanged (registry-driven). */
export function localizeRegistry(
  data: MeRegistry,
  locale: ShellLocale,
): MeRegistry {
  if (locale === "fr") return data;
  return {
    ...data,
    modules: data.modules.map((mod) => ({
      ...mod,
      name: MODULE_LABELS_IT[mod.key] ?? mod.name,
      features: mod.features.map((f) => ({
        ...f,
        label: FEATURE_LABELS_IT[f.id] ?? f.label,
      })),
    })),
  };
}
