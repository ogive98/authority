import type { ShellLocale } from "@/stores/locale-store";

/**
 * Shared métier status / tone labels (D166) — FR source, IT overlay.
 * Technical codes (OPEN, DRAFT…) stay English identifiers.
 */

const STATUS_I18N = {
  fr: {
    OPEN: "Ouvert",
    PARTIAL: "Partiel",
    CLOSED: "Soldé",
    DRAFT: "Brouillon",
    POSTED: "Postée",
    REVERSED: "Contrepassée",
    CONFIRMED: "Confirmée",
    CANCELLED: "Annulée",
    ISSUED: "Émise",
    READY: "Prêt",
    ASSIGNED: "Assigné",
    OUT: "En route",
    DELIVERED: "Livré",
    FAILED: "Échec",
    INVITED: "Invité",
    ACTIVE: "Actif",
    LOCKED: "Verrouillé",
    DISABLED: "Désactivé",
    OVERDUE: "Échue",
    SOFT_CLOSED: "Soft close",
    SUBMITTED: "Soumise",
    ACKNOWLEDGED: "Prise en compte",
    REJECTED: "Refusée",
    ALL: "Tous",
  },
  it: {
    OPEN: "Aperto",
    PARTIAL: "Parziale",
    CLOSED: "Saldato",
    DRAFT: "Bozza",
    POSTED: "Contabilizzata",
    REVERSED: "Stornata",
    CONFIRMED: "Confermata",
    CANCELLED: "Annullata",
    ISSUED: "Emessa",
    READY: "Pronto",
    ASSIGNED: "Assegnato",
    OUT: "In consegna",
    DELIVERED: "Consegnato",
    FAILED: "Fallito",
    INVITED: "Invitato",
    ACTIVE: "Attivo",
    LOCKED: "Bloccato",
    DISABLED: "Disattivato",
    OVERDUE: "Scaduto",
    SOFT_CLOSED: "Soft close",
    SUBMITTED: "Inviata",
    ACKNOWLEDGED: "Presa in carico",
    REJECTED: "Rifiutata",
    ALL: "Tutti",
  },
} as const;

export type StatusLabelKey = keyof (typeof STATUS_I18N)["fr"];

export function statusLabel(
  key: string,
  locale: ShellLocale,
  fallback?: string,
): string {
  const dict = STATUS_I18N[locale] as Record<string, string>;
  return dict[key] ?? fallback ?? key;
}

export function statusLabelsMap(
  locale: ShellLocale,
): Record<string, string> {
  return { ...STATUS_I18N[locale] };
}
