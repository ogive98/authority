export type CommandGroupId =
  | "navigation"
  | "search"
  | "actions"
  | "settings";

export type CommandShortcut = {
  /** Display label, e.g. "Ctrl+," — use metaLabel for Mac swap */
  keys: string[];
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export type CommandItem = {
  id: string;
  label: string;
  group: CommandGroupId;
  /** Hide if user lacks this grant */
  permissionKey?: string;
  href?: string;
  keywords?: string[];
  /** Module must be conceptually ON — UI-04 registry later */
  requiresModule?: string;
  /** Keyboard shortcut (shown in palette + optionally global) */
  shortcut?: CommandShortcut;
};

export const COMMAND_GROUP_LABELS: Record<CommandGroupId, string> = {
  navigation: "Navigation",
  search: "Recherche",
  actions: "Actions",
  settings: "Paramètres",
};

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
}

/** Format shortcut keys for current OS (Ctrl ↔ ⌘). */
export function formatShortcutKeys(keys: string[]): string[] {
  const mac = isMacPlatform();
  return keys.map((k) => {
    if (k === "Ctrl") return mac ? "⌘" : "Ctrl";
    if (k === "Alt") return mac ? "⌥" : "Alt";
    if (k === "Shift") return mac ? "⇧" : "Shift";
    return k;
  });
}

/**
 * Static command catalog for UI-08.
 * Items with permissionKey are filtered out when grant missing.
 */
export const COMMAND_CATALOG: CommandItem[] = [
  {
    id: "nav-home",
    label: "Tableau de bord",
    group: "navigation",
    href: "/",
    keywords: ["accueil", "home", "dashboard"],
    shortcut: { keys: ["Ctrl", "Shift", "H"], key: "h", ctrl: true, shift: true },
  },
  {
    id: "nav-settings",
    label: "Préférences",
    group: "navigation",
    href: "/settings",
    keywords: ["settings", "config"],
    shortcut: { keys: ["Ctrl", ","], key: ",", ctrl: true },
  },
  {
    id: "nav-products",
    label: "Produits",
    group: "navigation",
    href: "/products",
    keywords: ["produits", "products", "catalogue", "sku"],
    requiresModule: "products",
    permissionKey: "products.read",
  },
  {
    id: "nav-customers",
    label: "Clients",
    group: "navigation",
    href: "/customers",
    keywords: ["clients", "customers", "party"],
    requiresModule: "customers",
    permissionKey: "customers.read",
  },
  {
    id: "nav-inventory",
    label: "Stock",
    group: "navigation",
    href: "/inventory",
    keywords: ["stock", "inventory", "entrepôt", "solde"],
    requiresModule: "inventory",
    permissionKey: "inventory.read",
  },
  {
    id: "nav-sales",
    label: "Commandes",
    group: "navigation",
    href: "/sales",
    keywords: ["commandes", "sales", "order", "vente"],
    requiresModule: "sales",
    permissionKey: "sales.read",
  },
  {
    id: "nav-delivery",
    label: "Livraisons",
    group: "navigation",
    href: "/delivery",
    keywords: ["livraison", "delivery", "shipment", "livreur"],
    requiresModule: "delivery",
    permissionKey: "delivery.read",
  },
  {
    id: "nav-tokens",
    label: "Dev — Tokens",
    group: "navigation",
    href: "/dev/tokens",
    keywords: ["design", "theme"],
    shortcut: { keys: ["Ctrl", "Shift", "T"], key: "t", ctrl: true, shift: true },
  },
  {
    id: "nav-field-acl",
    label: "Dev — Field ACL",
    group: "navigation",
    href: "/dev/field-acl",
    keywords: ["wage", "salaire", "acl", "mask"],
  },
  {
    id: "nav-print",
    label: "Dev — Impression",
    group: "navigation",
    href: "/dev/print",
    keywords: ["print", "job", "bl", "document"],
  },
  {
    id: "nav-a11y",
    label: "Dev — Accessibilité",
    group: "navigation",
    href: "/dev/a11y",
    keywords: ["a11y", "skip", "contrast", "clavier"],
  },
  {
    id: "nav-datatable",
    label: "Dev — DataTable lots",
    group: "navigation",
    href: "/dev/datatable",
    keywords: ["lots", "table"],
    shortcut: { keys: ["Ctrl", "Shift", "L"], key: "l", ctrl: true, shift: true },
  },
  {
    id: "nav-forms",
    label: "Dev — Forms",
    group: "navigation",
    href: "/dev/forms",
    keywords: ["confirm", "drawer"],
    shortcut: { keys: ["Ctrl", "Shift", "F"], key: "f", ctrl: true, shift: true },
  },
  {
    id: "search-lot",
    label: "LOT-2026-0042 — Brie 250",
    group: "search",
    href: "/dev/datatable",
    keywords: ["lot", "brie", "stock"],
    requiresModule: "inventory",
  },
  {
    id: "search-so",
    label: "SO-2026-0042 — Commande Sfax",
    group: "search",
    href: "/sales",
    keywords: ["commande", "sales", "order"],
    requiresModule: "sales",
    permissionKey: "sales.read",
  },
  {
    id: "search-shipment",
    label: "SH-2026-0001 — Livraison Atlas",
    group: "search",
    href: "/delivery",
    keywords: ["livraison", "shipment", "delivery"],
    requiresModule: "delivery",
    permissionKey: "delivery.read",
  },
  {
    id: "search-customer",
    label: "Client — Fromagerie Atlas",
    group: "search",
    href: "/customers",
    keywords: ["client", "customer"],
    requiresModule: "customers",
    permissionKey: "customers.read",
  },
  {
    id: "act-theme",
    label: "Basculer thème clair / sombre",
    group: "actions",
    keywords: ["theme", "dark", "light"],
    shortcut: { keys: ["Ctrl", "Shift", "D"], key: "d", ctrl: true, shift: true },
  },
  {
    id: "act-payroll-export",
    label: "Exporter la paie",
    group: "actions",
    keywords: ["payroll", "export", "salaire"],
    permissionKey: "payroll.export",
    requiresModule: "payroll",
    shortcut: { keys: ["Ctrl", "Shift", "P"], key: "p", ctrl: true, shift: true },
  },
  {
    id: "set-company",
    label: "Changer de société / site",
    group: "settings",
    keywords: ["company", "site", "contexte"],
    shortcut: { keys: ["Ctrl", "Shift", "C"], key: "c", ctrl: true, shift: true },
  },
];

/** Demo grants — payroll.export intentionally absent (gate: hidden). */
export const DEMO_PERMISSION_GRANTS = new Set([
  "sales.read",
  "sales.write",
  "sales.confirm",
  "customers.read",
  "products.read",
  "inventory.read",
  "delivery.read",
  "delivery.prepare",
  "delivery.complete",
  "delivery.fail",
  "settings.read",
]);

/** Demo enabled modules — payroll OFF so related commands hide. */
export const DEMO_ENABLED_MODULES = new Set([
  "home",
  "settings",
  "platform",
  "sales",
  "inventory",
  "delivery",
  "customers",
  "products",
]);

export function filterCommands(
  items: CommandItem[],
  opts: {
    query: string;
    grants: Set<string>;
    enabledModules: Set<string>;
  },
): CommandItem[] {
  const q = opts.query.trim().toLowerCase();

  return items.filter((item) => {
    if (item.permissionKey && !opts.grants.has(item.permissionKey)) {
      return false;
    }
    if (item.requiresModule && !opts.enabledModules.has(item.requiresModule)) {
      return false;
    }
    if (!q) return true;
    const hay = [
      item.label,
      ...(item.keywords ?? []),
      ...(item.shortcut?.keys ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function groupCommands(
  items: CommandItem[],
): { group: CommandGroupId; label: string; items: CommandItem[] }[] {
  const order: CommandGroupId[] = [
    "navigation",
    "search",
    "actions",
    "settings",
  ];
  return order
    .map((group) => ({
      group,
      label: COMMAND_GROUP_LABELS[group],
      items: items.filter((i) => i.group === group),
    }))
    .filter((g) => g.items.length > 0);
}

export function matchShortcut(
  e: KeyboardEvent,
  shortcut: CommandShortcut,
): boolean {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const want = shortcut.key.length === 1 ? shortcut.key.toLowerCase() : shortcut.key;
  if (key !== want) return false;
  const mod = e.metaKey || e.ctrlKey;
  if (Boolean(shortcut.ctrl) !== mod) return false;
  if (Boolean(shortcut.shift) !== e.shiftKey) return false;
  if (Boolean(shortcut.alt) !== e.altKey) return false;
  return true;
}
