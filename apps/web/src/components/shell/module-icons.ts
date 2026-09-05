import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  Factory,
  FileText,
  Home,
  Landmark,
  LayoutGrid,
  MessageSquare,
  Package,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

/**
 * Module icons — thin stroke, Utility Cube set.
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
  supply: Truck,
  production: Factory,
  usine: Factory,
  payroll: Users,
  rh: Users,
  finance: Wallet,
  accounting: Landmark,
  customers: Users,
  master_data: Boxes,
  reports: BarChart3,
  pilotage: BarChart3,
  comms: MessageSquare,
  documents: FileText,
  orders: ClipboardList,
};

export function iconForModule(key: string): LucideIcon {
  return ICONS[key.toLowerCase()] ?? LayoutGrid;
}
