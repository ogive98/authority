import type { ShellLocale } from "@/stores/locale-store";
import type { CommandItem } from "@/lib/command-catalog";

/** Command palette / dock labels IT (D166) — ids stable, FR catalog remains source. */

export const COMMAND_LABELS_IT: Record<string, string> = {
  "nav-home": "Cruscotto",
  "nav-settings": "Preferenze",
  "nav-products": "Prodotti",
  "nav-customers": "Clienti",
  "nav-inventory": "Scorte",
  "nav-production": "Produzione",
  "nav-production-worksheets": "Schede digitali",
  "nav-hr": "Dipendenti",
  "nav-sales": "Ordini",
  "nav-delivery": "Consegne",
  "nav-tokens": "Dev — Token",
  "nav-field-acl": "Dev — Field ACL",
  "nav-print": "Dev — Stampa",
  "nav-a11y": "Dev — Accessibilità",
  "nav-datatable": "Dev — DataTable lotti",
  "nav-forms": "Dev — Form",
  "search-lot": "LOT-2026-0042 — Brie 250",
  "search-so": "SO-2026-0042 — Ordine Sfax",
  "search-shipment": "SH-2026-0001 — Consegna Atlas",
  "search-customer": "Cliente — Fromagerie Atlas",
  "act-theme": "Cambia tema chiaro / scuro",
  "act-payroll-export": "Esporta paghe",
  "set-company": "Cambia società / sito",
};

export function localizeCommandItem(
  item: CommandItem,
  locale: ShellLocale,
): CommandItem {
  if (locale === "fr") return item;
  const label = COMMAND_LABELS_IT[item.id];
  if (!label) return item;
  return { ...item, label };
}

export function localizeCommandItems(
  items: CommandItem[],
  locale: ShellLocale,
): CommandItem[] {
  if (locale === "fr") return items;
  return items.map((i) => localizeCommandItem(i, locale));
}
