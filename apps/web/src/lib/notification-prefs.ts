/** Soft Glass notification prefs — poste (D249). Mute per source + audio. */

export const NOTIF_SOURCE_KEYS = [
  "CREDIT_BREACH",
  "PROMISE_OVERDUE",
  "PORTAL_PAYMENT_DECL",
  "DUNNING_READY",
  "RAS_PENDING",
  "TEJ_PENDING",
  "ATM_REVIEW",
  "WA_INBOX",
] as const;

export type NotifSourceKey = (typeof NOTIF_SOURCE_KEYS)[number];

export type NotifSoundVariant = "soft" | "pulse" | "chime";

export type NotifMutedMap = Record<NotifSourceKey, boolean>;

export const NOTIF_SOURCE_META: Record<
  NotifSourceKey,
  { fr: string; it: string; hintFr: string; hintIt: string }
> = {
  CREDIT_BREACH: {
    fr: "Crédit breach",
    it: "Credito breach",
    hintFr: "Pression crédit ≥ limite (P0).",
    hintIt: "Pressione credito ≥ limite (P0).",
  },
  PROMISE_OVERDUE: {
    fr: "Promesses échues",
    it: "Promesse scadute",
    hintFr: "Promesse BROKEN ou OPEN après échéance.",
    hintIt: "Promesse BROKEN o OPEN dopo scadenza.",
  },
  PORTAL_PAYMENT_DECL: {
    fr: "Déclarations portail",
    it: "Dichiarazioni portale",
    hintFr: "Déclarations SUBMITTED à accuser.",
    hintIt: "Dichiarazioni SUBMITTED da accusare.",
  },
  DUNNING_READY: {
    fr: "Relances prêtes",
    it: "Solleciti pronti",
    hintFr: "Brouillons dunning DRAFT (confirm humain).",
    hintIt: "Bozze dunning DRAFT (conferma umana).",
  },
  RAS_PENDING: {
    fr: "RAS Prefs",
    it: "RAS Prefs",
    hintFr: "tax.ras en attente expert.",
    hintIt: "tax.ras in attesa expert.",
  },
  TEJ_PENDING: {
    fr: "TEJ Prefs",
    it: "TEJ Prefs",
    hintFr: "tax.tej en attente — pas de transmission.",
    hintIt: "tax.tej in attesa — nessuna trasmissione.",
  },
  ATM_REVIEW: {
    fr: "Automation",
    it: "Automazione",
    hintFr: "Runs ASSISTED / PENDING_APPROVAL.",
    hintIt: "Run ASSISTED / PENDING_APPROVAL.",
  },
  WA_INBOX: {
    fr: "Inbox WhatsApp",
    it: "Inbox WhatsApp",
    hintFr: "Messages OPEN/MATCHED → brouillon Soft Glass (humain).",
    hintIt: "Messaggi OPEN/MATCHED → bozza Soft Glass (umano).",
  },
};

export function defaultMutedMap(): NotifMutedMap {
  return {
    CREDIT_BREACH: false,
    PROMISE_OVERDUE: false,
    PORTAL_PAYMENT_DECL: false,
    DUNNING_READY: false,
    RAS_PENDING: false,
    TEJ_PENDING: false,
    ATM_REVIEW: false,
    WA_INBOX: false,
  };
}

export function isNotifSourceKey(v: string | undefined): v is NotifSourceKey {
  return !!v && (NOTIF_SOURCE_KEYS as readonly string[]).includes(v);
}

export function mergeMutedMap(
  partial?: Partial<NotifMutedMap> | null,
): NotifMutedMap {
  return { ...defaultMutedMap(), ...(partial ?? {}) };
}
