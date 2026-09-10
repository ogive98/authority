/**
 * Home Mission Control KPIs (D165/D168) — scoped to selected module.
 * No invented CA / €; TND amounts as-recorded from finance.
 */

export type FinanceHomeKpis = {
  outstandingOpen: string;
  openCount: number;
  overdueCount: number;
  currency: "TND";
};

export type SalesHomeKpis = {
  draftCount: number;
  confirmedCount: number;
  activeCount: number;
};

export type InventoryHomeKpis = {
  balanceLines: number;
  positiveAvailableLines: number;
  openLots: number;
};

export type DeliveryHomeKpis = {
  activeCount: number;
  readyCount: number;
  assignedCount: number;
  outCount: number;
};

export type HomeKpiCardState =
  | "loading"
  | "ok"
  | "module_off"
  | "forbidden"
  | "error"
  | "empty";

/** Stable ids → label keys in locale-store. */
export type HomeKpiId =
  | "arOpen"
  | "ordersActive"
  | "ordersDraft"
  | "ordersConfirmed"
  | "stockLines"
  | "stockBalances"
  | "stockLots"
  | "overdue"
  | "shipmentsActive"
  | "shipmentsReady"
  | "shipmentsOut"
  | "moduleFeatures";

export type HomeKpiCard = {
  id: HomeKpiId;
  href: string;
  state: HomeKpiCardState;
  value: string;
  /** Optional raw counts for localized hints in UI. */
  meta?: Record<string, number | string>;
};

type ApiFail = { ok: false; status: number; message: string };

async function getJson<T>(
  path: string,
): Promise<{ ok: true; data: T } | ApiFail> {
  try {
    const res = await fetch(path, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      return {
        ok: false,
        status: res.status,
        message: body.message ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

function formatTnd(raw: string): string {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString("fr-TN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function failState(res: ApiFail): HomeKpiCardState {
  if (res.status === 403) return "forbidden";
  return "error";
}

function offCard(id: HomeKpiId, href: string): HomeKpiCard {
  return { id, href, state: "module_off", value: "—" };
}

function emptyCard(id: HomeKpiId, href: string): HomeKpiCard {
  return { id, href, state: "empty", value: "—" };
}

async function financeCards(): Promise<HomeKpiCard[]> {
  const fin = await getJson<FinanceHomeKpis>("/api/v1/finance/home-kpis");
  if (!fin.ok) {
    const st = failState(fin);
    return [
      { id: "arOpen", href: "/finance", state: st, value: "—" },
      { id: "overdue", href: "/finance", state: st, value: "—" },
    ];
  }
  return [
    {
      id: "arOpen",
      href: "/finance",
      state: "ok",
      value: `${formatTnd(fin.data.outstandingOpen)} ${fin.data.currency}`,
      meta: { openCount: fin.data.openCount },
    },
    {
      id: "overdue",
      href: "/finance",
      state: "ok",
      value: String(fin.data.overdueCount),
      meta: { overdueCount: fin.data.overdueCount },
    },
  ];
}

async function salesCards(): Promise<HomeKpiCard[]> {
  const sales = await getJson<SalesHomeKpis>("/api/v1/sales/home-kpis");
  if (!sales.ok) {
    const st = failState(sales);
    return [
      { id: "ordersActive", href: "/sales", state: st, value: "—" },
      { id: "ordersDraft", href: "/sales", state: st, value: "—" },
      { id: "ordersConfirmed", href: "/sales", state: st, value: "—" },
    ];
  }
  return [
    {
      id: "ordersActive",
      href: "/sales",
      state: "ok",
      value: String(sales.data.activeCount),
      meta: { activeCount: sales.data.activeCount },
    },
    {
      id: "ordersDraft",
      href: "/sales",
      state: "ok",
      value: String(sales.data.draftCount),
      meta: { draftCount: sales.data.draftCount },
    },
    {
      id: "ordersConfirmed",
      href: "/sales",
      state: "ok",
      value: String(sales.data.confirmedCount),
      meta: { confirmedCount: sales.data.confirmedCount },
    },
  ];
}

async function inventoryCards(): Promise<HomeKpiCard[]> {
  const inv = await getJson<InventoryHomeKpis>("/api/v1/inventory/home-kpis");
  if (!inv.ok) {
    const st = failState(inv);
    return [
      { id: "stockLines", href: "/inventory", state: st, value: "—" },
      { id: "stockBalances", href: "/inventory", state: st, value: "—" },
      { id: "stockLots", href: "/inventory/lots", state: st, value: "—" },
    ];
  }
  return [
    {
      id: "stockLines",
      href: "/inventory",
      state: "ok",
      value: String(inv.data.positiveAvailableLines),
      meta: { positive: inv.data.positiveAvailableLines },
    },
    {
      id: "stockBalances",
      href: "/inventory",
      state: "ok",
      value: String(inv.data.balanceLines),
      meta: { balanceLines: inv.data.balanceLines },
    },
    {
      id: "stockLots",
      href: "/inventory/lots",
      state: "ok",
      value: String(inv.data.openLots),
      meta: { openLots: inv.data.openLots },
    },
  ];
}

async function deliveryCards(): Promise<HomeKpiCard[]> {
  const dlv = await getJson<DeliveryHomeKpis>("/api/v1/delivery/home-kpis");
  if (!dlv.ok) {
    const st = failState(dlv);
    return [
      { id: "shipmentsActive", href: "/delivery", state: st, value: "—" },
      { id: "shipmentsReady", href: "/delivery", state: st, value: "—" },
      { id: "shipmentsOut", href: "/delivery", state: st, value: "—" },
    ];
  }
  return [
    {
      id: "shipmentsActive",
      href: "/delivery",
      state: "ok",
      value: String(dlv.data.activeCount),
      meta: { activeCount: dlv.data.activeCount },
    },
    {
      id: "shipmentsReady",
      href: "/delivery",
      state: "ok",
      value: String(dlv.data.readyCount),
      meta: { readyCount: dlv.data.readyCount },
    },
    {
      id: "shipmentsOut",
      href: "/delivery",
      state: "ok",
      value: String(dlv.data.outCount + dlv.data.assignedCount),
      meta: {
        outCount: dlv.data.outCount,
        assignedCount: dlv.data.assignedCount,
      },
    },
  ];
}

/** Overview home: one card per domain that is ENABLED (still real APIs). */
async function homeOverviewCards(
  enabled: Set<string>,
): Promise<HomeKpiCard[]> {
  const tasks: Promise<HomeKpiCard | null>[] = [];

  if (enabled.has("finance")) {
    tasks.push(
      getJson<FinanceHomeKpis>("/api/v1/finance/home-kpis").then((fin) =>
        !fin.ok
          ? {
              id: "arOpen" as const,
              href: "/finance",
              state: failState(fin),
              value: "—",
            }
          : {
              id: "arOpen" as const,
              href: "/finance",
              state: "ok" as const,
              value: `${formatTnd(fin.data.outstandingOpen)} ${fin.data.currency}`,
              meta: { openCount: fin.data.openCount },
            },
      ),
    );
  }
  if (enabled.has("sales")) {
    tasks.push(
      getJson<SalesHomeKpis>("/api/v1/sales/home-kpis").then((sales) =>
        !sales.ok
          ? {
              id: "ordersActive" as const,
              href: "/sales",
              state: failState(sales),
              value: "—",
            }
          : {
              id: "ordersActive" as const,
              href: "/sales",
              state: "ok" as const,
              value: String(sales.data.activeCount),
              meta: { activeCount: sales.data.activeCount },
            },
      ),
    );
  }
  if (enabled.has("inventory")) {
    tasks.push(
      getJson<InventoryHomeKpis>("/api/v1/inventory/home-kpis").then((inv) =>
        !inv.ok
          ? {
              id: "stockLines" as const,
              href: "/inventory",
              state: failState(inv),
              value: "—",
            }
          : {
              id: "stockLines" as const,
              href: "/inventory",
              state: "ok" as const,
              value: String(inv.data.positiveAvailableLines),
              meta: { positive: inv.data.positiveAvailableLines },
            },
      ),
    );
  }
  if (enabled.has("delivery")) {
    tasks.push(
      getJson<DeliveryHomeKpis>("/api/v1/delivery/home-kpis").then((dlv) =>
        !dlv.ok
          ? {
              id: "shipmentsActive" as const,
              href: "/delivery",
              state: failState(dlv),
              value: "—",
            }
          : {
              id: "shipmentsActive" as const,
              href: "/delivery",
              state: "ok" as const,
              value: String(dlv.data.activeCount),
              meta: { activeCount: dlv.data.activeCount },
            },
      ),
    );
  } else if (enabled.has("finance")) {
    tasks.push(
      getJson<FinanceHomeKpis>("/api/v1/finance/home-kpis").then((fin) =>
        !fin.ok
          ? {
              id: "overdue" as const,
              href: "/finance",
              state: failState(fin),
              value: "—",
            }
          : {
              id: "overdue" as const,
              href: "/finance",
              state: "ok" as const,
              value: String(fin.data.overdueCount),
              meta: { overdueCount: fin.data.overdueCount },
            },
      ),
    );
  }

  const cards = (await Promise.all(tasks)).filter(
    (c): c is HomeKpiCard => c != null,
  );
  return cards.slice(0, 4);
}

/**
 * Load KPI cards for the selected Mission Control module only.
 */
export async function loadHomeKpiCards(
  enabledModules: Set<string>,
  focusModule: string,
): Promise<HomeKpiCard[]> {
  const mod = focusModule || "home";

  if (mod === "home" || mod === "platform") {
    return homeOverviewCards(enabledModules);
  }

  if (mod === "finance") {
    if (!enabledModules.has("finance")) {
      return [
        offCard("arOpen", "/finance"),
        offCard("overdue", "/finance"),
      ];
    }
    return financeCards();
  }

  if (mod === "sales") {
    if (!enabledModules.has("sales")) {
      return [
        offCard("ordersActive", "/sales"),
        offCard("ordersDraft", "/sales"),
        offCard("ordersConfirmed", "/sales"),
      ];
    }
    return salesCards();
  }

  if (mod === "inventory") {
    if (!enabledModules.has("inventory")) {
      return [
        offCard("stockLines", "/inventory"),
        offCard("stockBalances", "/inventory"),
        offCard("stockLots", "/inventory/lots"),
      ];
    }
    return inventoryCards();
  }

  if (mod === "delivery") {
    if (!enabledModules.has("delivery")) {
      return [
        offCard("shipmentsActive", "/delivery"),
        offCard("shipmentsReady", "/delivery"),
        offCard("shipmentsOut", "/delivery"),
      ];
    }
    return deliveryCards();
  }

  // Other modules: honest empty — no cross-module figures.
  const href =
    mod === "customers"
      ? "/customers"
      : mod === "products"
        ? "/products"
        : mod === "documents"
          ? "/documents"
          : mod === "hr"
            ? "/hr"
            : mod === "accounting"
              ? "/accounting"
              : mod === "tax"
                ? "/tax"
                : mod === "production"
                  ? "/production"
                  : mod === "repair"
                    ? "/repair"
                    : "/";
  return [emptyCard("moduleFeatures", href)];
}
