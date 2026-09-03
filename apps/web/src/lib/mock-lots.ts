export type LotStatus = "open" | "closed" | "quarantine";

export type LotRow = {
  id: string;
  sku: string;
  name: string;
  qtyKg: number;
  status: LotStatus;
  dlc: string;
  site: string;
};

const STATUSES: LotStatus[] = ["open", "closed", "quarantine"];
const SITES = ["Sfax", "Tunis", "Sousse"];
const NAMES = [
  "Brie 250",
  "Emmental bloc",
  "Mozzarella",
  "Ricotta",
  "Cheddar",
  "Fromage blanc",
];

/** Deterministic 1000-row mock — never fetch all at once in UI. */
export function buildMockLots(count = 1000): LotRow[] {
  const rows: LotRow[] = [];
  for (let i = 1; i <= count; i++) {
    const n = String(i).padStart(4, "0");
    rows.push({
      id: `LOT-2026-${n}`,
      sku: `SKU-${NAMES[i % NAMES.length]!.slice(0, 4).toUpperCase()}-${100 + (i % 50)}`,
      name: NAMES[i % NAMES.length]!,
      qtyKg: Math.round((50 + (i % 200) + (i % 7) * 0.125) * 1000) / 1000,
      status: STATUSES[i % STATUSES.length]!,
      dlc: `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
      site: SITES[i % SITES.length]!,
    });
  }
  return rows;
}

export type LotFilter = {
  q?: string;
  status?: LotStatus | "all";
};

export type LotColumnId =
  | "id"
  | "sku"
  | "name"
  | "qtyKg"
  | "status"
  | "dlc"
  | "site";

export const LOT_COLUMNS: {
  id: LotColumnId;
  label: string;
  numeric?: boolean;
}[] = [
  { id: "id", label: "Lot" },
  { id: "sku", label: "SKU" },
  { id: "name", label: "Produit" },
  { id: "qtyKg", label: "kg", numeric: true },
  { id: "status", label: "Statut" },
  { id: "dlc", label: "DLC" },
  { id: "site", label: "Site" },
];

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  totalFiltered: number;
};

/**
 * Cursor pagination over an in-memory list.
 * Cursor = last item id. Never returns unbounded arrays to the caller beyond `limit`.
 */
export function pageLots(
  all: LotRow[],
  opts: {
    cursor?: string | null;
    limit: number;
    filter?: LotFilter;
  },
): CursorPage<LotRow> {
  const limit = Math.min(Math.max(opts.limit, 1), 100);
  const q = opts.filter?.q?.trim().toLowerCase();
  const status = opts.filter?.status ?? "all";

  const filtered = all.filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    if (!q) return true;
    return (
      row.id.toLowerCase().includes(q) ||
      row.sku.toLowerCase().includes(q) ||
      row.name.toLowerCase().includes(q) ||
      row.site.toLowerCase().includes(q)
    );
  });

  let start = 0;
  if (opts.cursor) {
    const idx = filtered.findIndex((r) => r.id === opts.cursor);
    start = idx >= 0 ? idx + 1 : 0;
  }

  const items = filtered.slice(start, start + limit);
  const last = items[items.length - 1];
  const nextCursor =
    items.length === limit && start + limit < filtered.length && last
      ? last.id
      : null;

  return { items, nextCursor, totalFiltered: filtered.length };
}
