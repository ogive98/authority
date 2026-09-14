import type { LucideIcon } from "lucide-react";
import { iconForFeature, iconForModule } from "./module-icons";

/**
 * Per-feature visual identity: dedicated color + thematic motion.
 * Outline Lucide only — no filled chips / frames.
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

const FEATURE_RULES: Rule[] = [
  {
    match: /deliver|livr|tour|shipment|tournée/i,
    colorClass: "text-[#ff9f0a]",
    motion: "drive",
    kind: "truck",
  },
  {
    match: /prod|wo|usine|factory|atelier/i,
    colorClass: "text-[#636366]",
    motion: "smoke",
    kind: "factory",
  },
  {
    match: /invoice|facture|document/i,
    colorClass: "text-[#0a84ff]",
    motion: "doc",
    kind: "doc",
  },
  {
    match: /payment|paiement|encaiss|instrument/i,
    colorClass: "text-[#30d158]",
    motion: "coin",
    kind: "money",
  },
  {
    match: /promise|créance|open.?item|wallet|finance/i,
    colorClass: "text-[#34c759]",
    motion: "coin",
    kind: "wallet",
  },
  {
    match: /stock|lot|invent|package|colis/i,
    colorClass: "text-[#5e5ce6]",
    motion: "lift",
    kind: "package",
  },
  {
    match: /order|commande|clipboard/i,
    colorClass: "text-[#ffd60a]",
    motion: "stamp",
    kind: "order",
  },
  {
    match: /sales|vente|shopping|bag/i,
    colorClass: "text-[#ff375f]",
    motion: "cart",
    kind: "sales",
  },
  {
    match: /job.?title|poste|mansioni/i,
    colorClass: "text-[#64d2ff]",
    motion: "stamp",
    kind: "job",
  },
  {
    match: /bulletin|payslip|buste/i,
    colorClass: "text-[#0a84ff]",
    motion: "doc",
    kind: "doc",
  },
  {
    match: /customer|client|employé|contrat|hr|rh|user|people/i,
    colorClass: "text-[#bf5af2]",
    motion: "people",
    kind: "people",
  },
  {
    match: /tax|tva|fiscal|landmark|accounting|compta/i,
    colorClass: "text-[#ff9500]",
    motion: "stamp",
    kind: "tax",
  },
  {
    match: /repair|répar|wrench/i,
    colorClass: "text-[#64d2ff]",
    motion: "wrench",
    kind: "repair",
  },
  {
    match: /alert|alerte|signal/i,
    colorClass: "text-[#ff453a]",
    motion: "alert",
    kind: "alert",
  },
  {
    match: /task|tâche|todo|check/i,
    colorClass: "text-[#30d158]",
    motion: "check",
    kind: "task",
  },
  {
    match: /report|rapport|kpi|chart|pilot/i,
    colorClass: "text-[#0071e3]",
    motion: "chart",
    kind: "chart",
  },
  {
    match: /setting|préf|param|gear/i,
    colorClass: "text-[#8e8e93]",
    motion: "gear",
    kind: "settings",
  },
  {
    match: /dash|accueil|home|board|vue/i,
    colorClass: "text-[#0071e3]",
    motion: "home",
    kind: "home",
  },
  {
    match: /preview|aperçu|spark/i,
    colorClass: "text-[#af52de]",
    motion: "spark",
    kind: "spark",
  },
];

const MODULE_RULES: Rule[] = [
  {
    match: /^delivery|supply$/i,
    colorClass: "text-[#ff9f0a]",
    motion: "drive",
    kind: "truck",
  },
  {
    match: /^production|usine$/i,
    colorClass: "text-[#636366]",
    motion: "smoke",
    kind: "factory",
  },
  {
    match: /^finance|accounting$/i,
    colorClass: "text-[#34c759]",
    motion: "coin",
    kind: "wallet",
  },
  {
    match: /^inventory|stock$/i,
    colorClass: "text-[#5e5ce6]",
    motion: "lift",
    kind: "package",
  },
  {
    match: /^sales|commercial$/i,
    colorClass: "text-[#ff375f]",
    motion: "cart",
    kind: "sales",
  },
  {
    match: /^hr|rh|payroll|identity|customers|suppliers$/i,
    colorClass: "text-[#bf5af2]",
    motion: "people",
    kind: "people",
  },
  {
    match: /^tax$/i,
    colorClass: "text-[#ff9500]",
    motion: "stamp",
    kind: "tax",
  },
  {
    match: /^repair$/i,
    colorClass: "text-[#64d2ff]",
    motion: "wrench",
    kind: "repair",
  },
  {
    match: /^home|dashboard$/i,
    colorClass: "text-[#0071e3]",
    motion: "home",
    kind: "home",
  },
  {
    match: /^settings$/i,
    colorClass: "text-[#8e8e93]",
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
