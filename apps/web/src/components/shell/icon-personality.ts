import type { LucideIcon } from "lucide-react";
import { iconForFeature, iconForModule } from "./module-icons";

/**
 * Per-feature visual identity: Progressive OS blue / violet / sky only.
 * Outline Lucide only — no filled chips / frames · no raw hex.
 */
export type IconMotion =
  | "drive"
  | "smoke"
  | "coin"
  | "lift"
  | "stamp"
  | "pulse-soft"
  | "people"
  | "cart"
  | "wrench"
  | "spark"
  | "home"
  | "alert"
  | "check"
  | "chart"
  | "gear"
  | "doc"
  | "idle";

export type IconPersonality = {
  colorClass: string;
  motion: IconMotion;
  kind: string;
};

type Rule = {
  match: RegExp;
  colorClass: string;
  motion: IconMotion;
  kind: string;
};

/** Chrome accents only: text-a-accent | text-a-violet | text-a-sky */
const FEATURE_RULES: Rule[] = [
  {
    match: /deliver|livr|truck|shipment|tournée/i,
    colorClass: "text-a-sky",
    motion: "drive",
    kind: "truck",
  },
  {
    match: /prod|wo|usine|factory|atelier/i,
    colorClass: "text-a-fg-muted",
    motion: "smoke",
    kind: "factory",
  },
  {
    match: /invoice|facture|document/i,
    colorClass: "text-a-sky",
    motion: "doc",
    kind: "doc",
  },
  {
    match: /payment|paiement|encaiss|instrument/i,
    colorClass: "text-a-accent",
    motion: "coin",
    kind: "money",
  },
  {
    match: /promise|créance|open.?item|wallet|finance/i,
    colorClass: "text-a-accent",
    motion: "coin",
    kind: "wallet",
  },
  {
    match: /stock|lot|invent|package|colis/i,
    colorClass: "text-a-violet",
    motion: "lift",
    kind: "package",
  },
  {
    match: /order|commande|clipboard/i,
    colorClass: "text-a-accent",
    motion: "stamp",
    kind: "order",
  },
  {
    match: /sales|vente|shopping|bag/i,
    colorClass: "text-a-accent",
    motion: "cart",
    kind: "sales",
  },
  {
    match: /job.?title|poste|mansioni/i,
    colorClass: "text-a-sky",
    motion: "stamp",
    kind: "job",
  },
  {
    match: /bulletin|payslip|buste/i,
    colorClass: "text-a-sky",
    motion: "doc",
    kind: "doc",
  },
  {
    match: /customer|client|employé|contrat|hr|rh|user|people/i,
    colorClass: "text-a-violet",
    motion: "people",
    kind: "people",
  },
  {
    match: /tax|tva|fiscal|landmark|accounting|compta/i,
    colorClass: "text-a-violet",
    motion: "stamp",
    kind: "tax",
  },
  {
    match: /repair|répar|wrench/i,
    colorClass: "text-a-sky",
    motion: "wrench",
    kind: "repair",
  },
  {
    match: /alert|alerte|signal/i,
    colorClass: "text-a-violet",
    motion: "alert",
    kind: "alert",
  },
  {
    match: /task|tâche|todo|check/i,
    colorClass: "text-a-accent",
    motion: "check",
    kind: "task",
  },
  {
    match: /report|rapport|kpi|chart|pilot/i,
    colorClass: "text-a-sky",
    motion: "chart",
    kind: "chart",
  },
  {
    match: /setting|préf|param|gear/i,
    colorClass: "text-a-fg-subtle",
    motion: "gear",
    kind: "settings",
  },
  {
    match: /dash|accueil|home|board|vue/i,
    colorClass: "text-a-accent",
    motion: "home",
    kind: "home",
  },
  {
    match: /preview|aperçu|spark/i,
    colorClass: "text-a-violet",
    motion: "spark",
    kind: "spark",
  },
];

const MODULE_RULES: Rule[] = [
  {
    match: /^delivery|supply$/i,
    colorClass: "text-a-sky",
    motion: "drive",
    kind: "truck",
  },
  {
    match: /^production|usine$/i,
    colorClass: "text-a-fg-muted",
    motion: "smoke",
    kind: "factory",
  },
  {
    match: /^finance|accounting$/i,
    colorClass: "text-a-accent",
    motion: "coin",
    kind: "wallet",
  },
  {
    match: /^inventory|stock$/i,
    colorClass: "text-a-violet",
    motion: "lift",
    kind: "package",
  },
  {
    match: /^sales|commercial$/i,
    colorClass: "text-a-accent",
    motion: "cart",
    kind: "sales",
  },
  {
    match: /^hr|rh|payroll|identity|customers|suppliers$/i,
    colorClass: "text-a-violet",
    motion: "people",
    kind: "people",
  },
  {
    match: /^tax$/i,
    colorClass: "text-a-violet",
    motion: "stamp",
    kind: "tax",
  },
  {
    match: /^repair$/i,
    colorClass: "text-a-sky",
    motion: "wrench",
    kind: "repair",
  },
  {
    match: /^home|dashboard$/i,
    colorClass: "text-a-accent",
    motion: "home",
    kind: "home",
  },
  {
    match: /^settings$/i,
    colorClass: "text-a-fg-subtle",
    motion: "gear",
    kind: "settings",
  },
];

const FALLBACK: IconPersonality = {
  colorClass: "text-a-accent",
  motion: "pulse-soft",
  kind: "generic",
};

function fromRules(hay: string, rules: Rule[]): IconPersonality | null {
  for (const rule of rules) {
    if (rule.match.test(hay)) {
      return {
        colorClass: rule.colorClass,
        motion: rule.motion,
        kind: rule.kind,
      };
    }
  }
  return null;
}

export function personalityForFeature(
  id: string,
  label: string,
): IconPersonality {
  return fromRules(`${id} ${label}`, FEATURE_RULES) ?? FALLBACK;
}

export function personalityForModule(key: string): IconPersonality {
  return fromRules(key, MODULE_RULES) ?? FALLBACK;
}

export function resolveFeatureIcon(id: string, label: string): LucideIcon {
  return iconForFeature(id, label);
}

export function resolveModuleIcon(key: string): LucideIcon {
  return iconForModule(key);
}
