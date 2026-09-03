import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Factory,
  Home,
  Landmark,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  BarChart3,
  MessageSquare,
} from "lucide-react";

export type ModuleFeature = {
  id: string;
  label: string;
  href: string;
};

export type ShellModule = {
  id: string;
  label: string;
  icon: LucideIcon;
  features: ModuleFeature[];
};

/**
 * Stub modules until UI-04 registry.
 * Empty feature lists = module known but OFF (hidden from rail).
 */
export const SHELL_MODULES: ShellModule[] = [
  {
    id: "home",
    label: "Accueil",
    icon: Home,
    features: [
      { id: "dashboard", label: "Tableau de bord", href: "/" },
      { id: "tasks", label: "Tâches", href: "/#tasks" },
      { id: "alerts", label: "Alertes", href: "/#alerts" },
    ],
  },
  {
    id: "commercial",
    label: "Commercial",
    icon: ShoppingCart,
    features: [],
  },
  {
    id: "supply",
    label: "Supply",
    icon: Truck,
    features: [],
  },
  {
    id: "usine",
    label: "Usine",
    icon: Factory,
    features: [],
  },
  {
    id: "inventory",
    label: "Stocks",
    icon: Package,
    features: [],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Landmark,
    features: [],
  },
  {
    id: "rh",
    label: "RH",
    icon: Users,
    features: [],
  },
  {
    id: "comms",
    label: "Comms",
    icon: MessageSquare,
    features: [],
  },
  {
    id: "pilotage",
    label: "Pilotage",
    icon: BarChart3,
    features: [],
  },
  {
    id: "settings",
    label: "Paramètres",
    icon: Settings,
    features: [
      { id: "prefs", label: "Préférences", href: "/settings" },
      { id: "company", label: "Société / sites", href: "/settings#company" },
    ],
  },
];

export function visibleModules(): ShellModule[] {
  return SHELL_MODULES.filter((m) => m.features.length > 0);
}

export function getModule(id: string): ShellModule | undefined {
  return SHELL_MODULES.find((m) => m.id === id);
}

export { LayoutDashboard, Building2 };
