import type { ShellLocale } from "@/stores/locale-store";

/**
 * Route / UI string overlays (D184) — FR is source; IT client overlay.
 * Covers breadcrumbs + common screen headers / tabs without rewriting every page.
 */

export const ROUTE_LABELS_FR: Record<string, string> = {
  "": "Accueil",
  settings: "Paramètres",
  preferences: "Préférences",
  preview: "Aperçu",
  products: "Produits",
  customers: "Clients",
  sales: "Ventes",
  inventory: "Stock",
  lots: "Lots",
  "certificat-salubrite": "Certificat de salubrité",
  articles: "Certificat de salubrité",
  delivery: "Livraison",
  finance: "Finance",
  invoices: "Factures",
  payments: "Encaissements",
  instruments: "Instruments",
  promises: "Promesses",
  accounting: "Comptabilité",
  tax: "Fiscalité",
  hr: "Ressources humaines",
  production: "Production",
  repair: "Réparation",
  documents: "Documents",
  help: "Aide",
  guide: "Guide",
  commandes: "Commandes",
  search: "Recherche",
  portal: "Portail",
  account: "Mon compte",
  users: "Utilisateurs",
  identity: "Identité",
  detail: "Détail",
  fiche: "Fiche",
};

export const ROUTE_LABELS_IT: Record<string, string> = {
  "": "Home",
  settings: "Impostazioni",
  preferences: "Preferenze",
  preview: "Anteprima",
  products: "Prodotti",
  customers: "Clienti",
  sales: "Vendite",
  inventory: "Scorte",
  lots: "Lotti",
  "certificat-salubrite": "Certificato di salubrità",
  articles: "Certificato di salubrità",
  delivery: "Consegne",
  finance: "Finanza",
  invoices: "Fatture",
  payments: "Incassi",
  instruments: "Strumenti",
  promises: "Promesse",
  accounting: "Contabilità",
  tax: "Fiscalità",
  hr: "Risorse umane",
  production: "Produzione",
  repair: "Riparazione",
  documents: "Documenti",
  help: "Aiuto",
  guide: "Guida",
  commandes: "Ordini",
  search: "Ricerca",
  portal: "Portale",
  account: "Il mio account",
  users: "Utenti",
  identity: "Identità",
  detail: "Dettaglio",
  fiche: "Scheda",
};

/** Exact FR → IT for screen headers, kickers, tab chips, common chrome. */
export const UI_STRINGS_IT: Record<string, string> = {
  Accueil: "Home",
  Finance: "Finanza",
  Factures: "Fatture",
  Encaissements: "Incassi",
  Instruments: "Strumenti",
  Promesses: "Promesse",
  Créances: "Crediti",
  Comptabilité: "Contabilità",
  "Grand livre": "Libro mastro",
  "Plan comptable": "Piano dei conti",
  Balance: "Bilancio di verifica",
  Écritures: "Registrazioni",
  "Mapping GL": "Mapping GL",
  Clients: "Clienti",
  Ventes: "Vendite",
  Stock: "Scorte",
  Livraison: "Consegne",
  Fiscalité: "Fiscalità",
  "Ressources humaines": "Risorse umane",
  Production: "Produzione",
  Réparation: "Riparazione",
  Documents: "Documenti",
  Produits: "Prodotti",
  Identité: "Identità",
  Paramètres: "Impostazioni",
  Préférences: "Preferenze",
  Aide: "Aiuto",
  "Mon compte": "Il mio account",
  Utilisateurs: "Utenti",
  Portail: "Portale",
  Lots: "Lotti",
  "Certificat de salubrité": "Certificato di salubrità",
  Recherche: "Ricerca",
  Détail: "Dettaglio",
  Fiche: "Scheda",
  Période: "Periodo",
  Code: "Codice",
  Nom: "Nome",
  Type: "Tipo",
  Actions: "Azioni",
  Statut: "Stato",
  Client: "Cliente",
  "Nouvelle facture": "Nuova fattura",
  "Nouveau client": "Nuovo cliente",
  Filtrer: "Filtra",
  Émettre: "Emetti",
  Annuler: "Annulla",
};

export function routeLabel(
  part: string,
  locale: ShellLocale,
  fallbackKey?: "detail" | "fiche",
): string {
  if (locale === "it") {
    if (ROUTE_LABELS_IT[part]) return ROUTE_LABELS_IT[part]!;
    if (fallbackKey && ROUTE_LABELS_IT[fallbackKey]) {
      return ROUTE_LABELS_IT[fallbackKey]!;
    }
  }
  if (ROUTE_LABELS_FR[part]) return ROUTE_LABELS_FR[part]!;
  if (fallbackKey && ROUTE_LABELS_FR[fallbackKey]) {
    return ROUTE_LABELS_FR[fallbackKey]!;
  }
  return part;
}

export function localizeUiString(
  value: string | undefined,
  locale: ShellLocale,
): string | undefined {
  if (!value) return value;
  if (locale !== "it") return value;
  return UI_STRINGS_IT[value] ?? value;
}
