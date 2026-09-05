import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Building2,
  Factory,
  Home,
  Landmark,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  BarChart3,
  MessageSquare,
  Boxes,
  LayoutGrid,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  settings: Settings,
  platform: LayoutGrid,
  identity: Users,
  organization: Building2,
  monitoring: Activity,
  sales: ShoppingCart,
  inventory: Package,
  delivery: Truck,
  production: Factory,
  payroll: Landmark,
  customers: Users,
  master_data: Boxes,
  commercial: ShoppingCart,
  supply: Truck,
  usine: Factory,
  finance: Landmark,
  rh: Users,
  comms: MessageSquare,
  pilotage: BarChart3,
};

export function iconForModule(key: string): LucideIcon {
  return ICONS[key] ?? LayoutGrid;
}
