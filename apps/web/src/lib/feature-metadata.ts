/**
 * FeatureMetadata (Track A / D278) — semantic overlay on existing command-catalog.
 * Does NOT create a parallel ActionRegistry — enriches COMMAND_CATALOG entries.
 */

import type { ActionDangerLevel, ActionDefinition } from "./action-registry";
import {
  ACTION_REGISTRY,
  getActionRegistry,
  type ActionContext,
} from "./action-registry";
import type { CommandItem } from "./command-catalog";
import type { ShellLocale } from "@/stores/locale-store";

export type FeatureMetadataLabels = {
  fr: string;
  en?: string;
  it?: string;
};

export type FeatureMetadataUi = {
  preferredPresentation?:
    | "smart-action"
    | "command"
    | "primary"
    | "overflow"
    | "inline";
  importance?: "primary" | "secondary" | "tertiary";
  density?: "compact" | "comfortable" | "spacious";
};

export type FeatureMetadataAi = {
  discoverable?: boolean;
  executable?: boolean;
};

/** Full semantic shape from UI OS prompt — optional fields are progressive. */
export type FeatureMetadata = {
  id: string;
  module?: string;
  entity?: string;
  type: "action" | "navigation" | "search" | "settings";
  operation?: string;
  label: FeatureMetadataLabels;
  shortLabel?: FeatureMetadataLabels;
  description?: FeatureMetadataLabels;
  keywords: string[];
  aliases?: string[];
  tags?: string[];
  category?: string;
  subcategory?: string;
  permissions?: string[];
  contexts: ActionContext[];
  relatedEntities?: string[];
  relatedActions?: string[];
  icon?: string;
  shortcut?: CommandItem["shortcut"];
  route?: string;
  priority?: number;
  ui?: FeatureMetadataUi;
  ai?: FeatureMetadataAi;
  confirmation?: boolean;
  dangerLevel: ActionDangerLevel;
  searchable?: boolean;
  discoverable?: boolean;
  executable?: boolean;
  auditRequired?: boolean;
};

/** Optional enrichment keyed by command/action id — FR labels stay in catalog. */
export type FeatureMetadataEnrichment = Partial<
  Omit<FeatureMetadata, "id" | "label" | "keywords" | "contexts" | "type">
> & {
  aliases?: string[];
  tags?: string[];
  entity?: string;
  operation?: string;
  description?: FeatureMetadataLabels;
  relatedEntities?: string[];
  relatedActions?: string[];
  icon?: string;
  ui?: FeatureMetadataUi;
  ai?: FeatureMetadataAi;
};

/**
 * Progressive enrichments — only ids that need more than catalog defaults.
 * Add entries here instead of inventing a second registry.
 */
export const FEATURE_METADATA_ENRICHMENTS: Record<
  string,
  FeatureMetadataEnrichment
> = {
  "nav-home": {
    tags: ["shell", "mission-control"],
    icon: "shell.home",
    ui: { preferredPresentation: "command", importance: "primary" },
    ai: { discoverable: true, executable: true },
  },
  "nav-products": {
    module: "products",
    entity: "product",
    tags: ["products", "sku", "catalogue"],
    icon: "products.nav",
    aliases: ["articles", "sku", "prodotti"],
    relatedEntities: ["lot", "inventory"],
    ai: { discoverable: true, executable: true },
  },
  "nav-customers": {
    module: "customers",
    entity: "customer",
    tags: ["customers", "party", "360"],
    icon: "customers.nav",
    aliases: ["clients", "clienti", "party"],
    relatedEntities: ["order", "invoice"],
    ai: { discoverable: true, executable: true },
  },
  "nav-inventory": {
    module: "inventory",
    entity: "stock",
    tags: ["inventory", "stock", "warehouse"],
    icon: "inventory.nav",
    aliases: ["entrepôt", "scorte", "stock"],
    relatedEntities: ["lot", "product"],
    ai: { discoverable: true, executable: true },
  },
  "nav-production": {
    module: "production",
    entity: "work_order",
    tags: ["production", "of", "atelier"],
    icon: "production.nav",
    aliases: ["OF", "fabrication", "produzione"],
    ai: { discoverable: true, executable: true },
  },
  "nav-hr": {
    module: "hr",
    entity: "employee",
    tags: ["hr", "employee", "cnss"],
    icon: "hr.nav",
    aliases: ["rh", "employés", "dipendenti", "cnss"],
    relatedEntities: ["bulletin", "leave"],
    ai: { discoverable: true, executable: true },
  },
  "nav-sales": {
    entity: "order",
    tags: ["sales", "order"],
    icon: "sales.nav",
    relatedEntities: ["customer", "product", "delivery"],
    aliases: ["ventes", "ordini"],
    ai: { discoverable: true, executable: true },
  },
  "nav-delivery": {
    module: "delivery",
    entity: "shipment",
    tags: ["delivery", "shipment", "tour"],
    icon: "delivery.nav",
    aliases: ["livraisons", "BL", "consegne", "tournée"],
    relatedEntities: ["order", "fleet"],
    ai: { discoverable: true, executable: true },
  },
  "nav-finance": {
    entity: "finance",
    tags: ["finance", "ar", "ap"],
    icon: "finance.nav",
    relatedEntities: ["invoice", "payment", "ap_bill"],
    ai: { discoverable: true, executable: true },
  },
  "nav-ap-bills": {
    module: "finance",
    entity: "ap_bill",
    operation: "list",
    tags: ["finance", "ap", "bill"],
    icon: "finance.ap_bill.list",
    relatedActions: ["action-ap-bill-create"],
    aliases: ["factures fournisseurs", "fatture fornitori", "AP"],
    ai: { discoverable: true, executable: true },
  },
  "nav-automation": {
    module: "automation",
    entity: "automation_profile",
    tags: ["automation", "assisted"],
    icon: "automation.nav",
    aliases: ["assisté", "automazione", "profil"],
    description: {
      fr: "Automatisation ASSISTED — FULL_AUTO interdit",
      it: "Automazione ASSISTED — FULL_AUTO vietato",
    },
    ai: { discoverable: true, executable: false },
  },
  "nav-forge": {
    module: "forge",
    entity: "extension",
    tags: ["forge", "extension", "metadata"],
    icon: "forge.nav",
    aliases: ["extensions", "forge", "personnalisation", "métadonnées"],
    description: {
      fr: "Extensions + métadonnées tenant — pas d’agent IA",
      it: "Estensioni + metadata tenant — nessun agente IA",
    },
    ai: { discoverable: true, executable: false },
  },
  "nav-settings": {
    tags: ["settings", "prefs"],
    icon: "settings.nav",
    ai: { discoverable: true, executable: true },
  },
};

function inferType(item: CommandItem): FeatureMetadata["type"] {
  if (item.group === "navigation") return "navigation";
  if (item.group === "search") return "search";
  if (item.group === "settings") return "settings";
  return "action";
}

function fromAction(
  action: ActionDefinition,
  enrichment?: FeatureMetadataEnrichment,
): FeatureMetadata {
  return {
    id: action.id,
    module: enrichment?.module ?? action.moduleId ?? action.requiresModule,
    entity: enrichment?.entity,
    type: inferType(action),
    operation: enrichment?.operation,
    label: { fr: action.label },
    shortLabel: enrichment?.shortLabel,
    description: enrichment?.description,
    keywords: action.keywords ?? [],
    aliases: enrichment?.aliases,
    tags: enrichment?.tags,
    permissions: action.permissionKey ? [action.permissionKey] : undefined,
    contexts: action.contexts,
    relatedEntities: enrichment?.relatedEntities,
    relatedActions: enrichment?.relatedActions,
    icon: enrichment?.icon ?? action.id,
    shortcut: action.shortcut,
    route: action.href,
    priority: enrichment?.priority ?? action.dockPriority,
    ui: enrichment?.ui ?? {
      preferredPresentation:
        action.group === "actions" ? "smart-action" : "command",
      importance: action.group === "navigation" ? "primary" : "secondary",
    },
    ai: enrichment?.ai ?? { discoverable: true, executable: !!action.href },
    confirmation: enrichment?.confirmation,
    dangerLevel: enrichment?.dangerLevel ?? action.dangerLevel,
    searchable: enrichment?.searchable ?? true,
    discoverable: enrichment?.discoverable ?? true,
    executable: enrichment?.executable ?? !!action.href,
    auditRequired: enrichment?.auditRequired,
  };
}

/** Build FeatureMetadata list from ACTION_REGISTRY + enrichments (no parallel store). */
export function buildFeatureMetadataCatalog(
  locale: ShellLocale = "fr",
): FeatureMetadata[] {
  const actions = getActionRegistry(locale);
  return actions.map((a) =>
    fromAction(a, FEATURE_METADATA_ENRICHMENTS[a.id]),
  );
}

export function getFeatureMetadata(
  id: string,
  locale: ShellLocale = "fr",
): FeatureMetadata | undefined {
  return buildFeatureMetadataCatalog(locale).find((f) => f.id === id);
}

/** Search by label, keywords, aliases, tags — feeds ⌘K / future semantic search. */
export function searchFeatureMetadata(
  query: string,
  locale: ShellLocale = "fr",
  limit = 20,
): FeatureMetadata[] {
  const q = query.trim().toLowerCase();
  if (!q) return buildFeatureMetadataCatalog(locale).slice(0, limit);
  const scored = buildFeatureMetadataCatalog(locale)
    .map((f) => {
      let score = 0;
      const label = (f.label[locale] ?? f.label.fr).toLowerCase();
      if (label === q) score += 100;
      else if (label.includes(q)) score += 40;
      for (const k of f.keywords) {
        if (k.toLowerCase() === q) score += 50;
        else if (k.toLowerCase().includes(q)) score += 20;
      }
      for (const a of f.aliases ?? []) {
        if (a.toLowerCase().includes(q)) score += 25;
      }
      for (const t of f.tags ?? []) {
        if (t.toLowerCase().includes(q)) score += 15;
      }
      if (f.id.toLowerCase().includes(q)) score += 10;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.f);
}

/** Coverage audit — features without enrichment still count as covered via catalog. */
export function featureMetadataCoverage(): {
  catalogSize: number;
  enriched: number;
  missingEnrichmentIds: string[];
} {
  const ids = ACTION_REGISTRY.map((a) => a.id);
  const enriched = ids.filter((id) => FEATURE_METADATA_ENRICHMENTS[id]);
  return {
    catalogSize: ids.length,
    enriched: enriched.length,
    missingEnrichmentIds: ids.filter((id) => !FEATURE_METADATA_ENRICHMENTS[id]),
  };
}

/**
 * Bridge D279 — map ACTIVE FrgMetadataDefinition rows onto command ids.
 * schemaJson.commandId required; aliases/tags optional arrays of strings.
 * Does not create a parallel registry — overlays only.
 */
export type ForgeMetadataBridgeItem = {
  status?: string;
  schemaJson?: Record<string, unknown>;
};

export function enrichmentsFromForgeMetadataBridge(
  items: ForgeMetadataBridgeItem[],
): Record<string, FeatureMetadataEnrichment> {
  const out: Record<string, FeatureMetadataEnrichment> = {};
  for (const item of items) {
    if (item.status && item.status !== "ACTIVE") continue;
    const schema = item.schemaJson ?? {};
    const commandId =
      typeof schema.commandId === "string" ? schema.commandId.trim() : "";
    if (!commandId) continue;
    const aliases = Array.isArray(schema.aliases)
      ? schema.aliases.filter((a): a is string => typeof a === "string")
      : [];
    const tags = Array.isArray(schema.tags)
      ? schema.tags.filter((t): t is string => typeof t === "string")
      : [];
    const prev = out[commandId] ?? {};
    out[commandId] = {
      ...prev,
      aliases: [...new Set([...(prev.aliases ?? []), ...aliases])],
      tags: [...new Set([...(prev.tags ?? []), ...tags, "forge-bridge"])],
    };
  }
  return out;
}

export function mergeFeatureMetadataEnrichments(
  ...maps: Array<Record<string, FeatureMetadataEnrichment>>
): Record<string, FeatureMetadataEnrichment> {
  const out: Record<string, FeatureMetadataEnrichment> = {};
  for (const map of maps) {
    for (const [id, e] of Object.entries(map)) {
      const prev = out[id];
      if (!prev) {
        out[id] = { ...e };
        continue;
      }
      out[id] = {
        ...prev,
        ...e,
        aliases: [...new Set([...(prev.aliases ?? []), ...(e.aliases ?? [])])],
        tags: [...new Set([...(prev.tags ?? []), ...(e.tags ?? [])])],
        relatedEntities: [
          ...new Set([
            ...(prev.relatedEntities ?? []),
            ...(e.relatedEntities ?? []),
          ]),
        ],
        relatedActions: [
          ...new Set([
            ...(prev.relatedActions ?? []),
            ...(e.relatedActions ?? []),
          ]),
        ],
      };
    }
  }
  return out;
}

export function buildFeatureMetadataCatalogWithOverlays(
  locale: ShellLocale = "fr",
  overlays: Record<string, FeatureMetadataEnrichment> = {},
): FeatureMetadata[] {
  const merged = mergeFeatureMetadataEnrichments(
    FEATURE_METADATA_ENRICHMENTS,
    overlays,
  );
  const actions = getActionRegistry(locale);
  return actions.map((a) => fromAction(a, merged[a.id]));
}

export function searchFeatureMetadataWithOverlays(
  query: string,
  locale: ShellLocale = "fr",
  limit = 20,
  overlays: Record<string, FeatureMetadataEnrichment> = {},
): FeatureMetadata[] {
  const catalog = buildFeatureMetadataCatalogWithOverlays(locale, overlays);
  const q = query.trim().toLowerCase();
  if (!q) return catalog.slice(0, limit);
  const scored = catalog
    .map((f) => {
      let score = 0;
      const label = (f.label[locale] ?? f.label.fr).toLowerCase();
      if (label === q) score += 100;
      else if (label.includes(q)) score += 40;
      for (const k of f.keywords) {
        if (k.toLowerCase() === q) score += 50;
        else if (k.toLowerCase().includes(q)) score += 20;
      }
      for (const a of f.aliases ?? []) {
        if (a.toLowerCase().includes(q)) score += 25;
      }
      for (const t of f.tags ?? []) {
        if (t.toLowerCase().includes(q)) score += 15;
      }
      if (f.id.toLowerCase().includes(q)) score += 10;
      return { f, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.f);
}
