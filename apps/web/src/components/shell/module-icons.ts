import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  Briefcase,
  Building2,
  CheckSquare,
  ClipboardList,
  Factory,
  FileText,
  Home,
  Landmark,
  LayoutGrid,
  MessageSquare,
  Package,
  Puzzle,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

/**
 * Module icons — Contiental set (elegant stroke).
 * Keys match registry module.key (lowercase).
 */
const ICONS: Record<string, LucideIcon> = {
  home: Home,
  dashboard: Home,
  settings: Settings,
  platform: LayoutGrid,
  identity: Users,
  organization: Building2,
  monitoring: Activity,
  sales: ShoppingBag,
  commercial: ShoppingBag,
  purchases: ShoppingCart,
  inventory: Package,
  stock: Package,
  delivery: Truck,
  fleet: Truck,
  maintenance: Wrench,
  supply: Truck,
  production: Factory,
  usine: Factory,
  payroll: Users,
  hr: Users,
  rh: Users,
  tax: Landmark,
  repair: Wrench,
  finance: Wallet,
  accounting: Landmark,
  customers: Users,
  suppliers: Truck,
  master_data: Boxes,
  reports: BarChart3,
  pilotage: BarChart3,
  comms: MessageSquare,
  documents: FileText,
  orders: ClipboardList,
  automation: Sparkles,
  forge: Puzzle,
};

const FEATURE_ICONS: { match: RegExp; icon: LucideIcon }[] = [
  { match: /task|tâche|todo/i, icon: CheckSquare },
  { match: /alert|alerte|signal/i, icon: AlertTriangle },
  { match: /dash|accueil|home|board/i, icon: Home },
  { match: /order|commande/i, icon: ClipboardList },
  { match: /invoice|facture/i, icon: FileText },
  { match: /payment|paiement|promise|créance/i, icon: Wallet },
  { match: /customer|client/i, icon: Users },
  { match: /supplier|fournisseur|vendor/i, icon: Truck },
  { match: /stock|lot|invent/i, icon: Package },
  { match: /deliver|livr|truck/i, icon: Truck },
  { match: /prod|wo|usine/i, icon: Factory },
  { match: /job.?title|poste|mansioni/i, icon: Briefcase },
  { match: /bulletin|payslip|buste/i, icon: FileText },
  { match: /hr|employé|contrat|rh/i, icon: Users },
  { match: /tax|tva|fiscal/i, icon: Landmark },
  { match: /repair|répar/i, icon: Wrench },
  { match: /setting|préf|param/i, icon: Settings },
  { match: /report|rapport|kpi/i, icon: BarChart3 },
];

export type NavTone = "violet" | "sky" | "orange";

const TONES: NavTone[] = ["violet", "sky", "orange"];

export function iconForModule(key: string): LucideIcon {
  return ICONS[key.toLowerCase()] ?? LayoutGrid;
}

export function iconForFeature(id: string, label: string): LucideIcon {
  const hay = `${id} ${label}`;
  for (const row of FEATURE_ICONS) {
    if (row.match.test(hay)) return row.icon;
  }
  return Sparkles;
}

export function toneForIndex(index: number): NavTone {
  return TONES[index % TONES.length]!;
}

export function toneClasses(tone: NavTone, active: boolean) {
  if (tone === "sky") {
    return {
      chip: active
        ? "bg-a-sky text-white"
        : "bg-a-sky-soft text-a-sky",
      text: active ? "text-a-sky" : "text-a-fg-muted",
      ring: "",
    };
  }
  if (tone === "orange") {
    /* Legacy tone key — maps to violet (blue/violet/sky chrome only). */
    return {
      chip: active
        ? "bg-a-violet text-white"
        : "bg-a-violet-soft text-a-violet",
      text: active ? "text-a-violet" : "text-a-fg-muted",
      ring: "",
    };
  }
  return {
    chip: active
      ? "bg-a-violet text-white"
      : "bg-a-violet-soft text-a-violet",
    text: active ? "text-a-violet" : "text-a-fg-muted",
    ring: "",
  };
}

/** Short legend under a feature badge (max ~14 chars). */
export function featureLegend(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= 14) return trimmed;
  const first = trimmed.split(/[\s/·–—-]+/)[0] ?? trimmed;
  if (first.length <= 14) return first;
  return `${trimmed.slice(0, 12)}…`;
}
