import type { ActionDef } from "./types";

/** Local action registry — later fed by AUTHORITY manifests / Thunder */
export const ACTION_REGISTRY: ActionDef[] = [
  {
    id: "transfer",
    icon: "⇄",
    title: "Virement",
    module: "finance",
    route: "/finance/banking",
    entityKinds: ["supplier", "customer", "employee"],
  },
  {
    id: "ap_payment",
    icon: "◉",
    title: "Paiement fournisseur",
    module: "finance",
    route: "/finance/ap-bills",
    entityKinds: ["supplier"],
  },
  {
    id: "ar_payment",
    icon: "◇",
    title: "Encaissement client",
    module: "finance",
    route: "/finance/payments",
    entityKinds: ["customer"],
  },
  {
    id: "expense",
    icon: "$",
    title: "Dépense",
    module: "finance",
    route: "/finance/banking",
    entityKinds: ["supplier", "contact"],
  },
  {
    id: "journal",
    icon: "▣",
    title: "Écriture comptable",
    module: "accounting",
    route: "/accounting",
    entityKinds: ["supplier", "customer"],
  },
  {
    id: "open_entity",
    icon: "○",
    title: "Ouvrir la fiche",
    module: "master_data",
    route: "/suppliers",
    entityKinds: ["supplier", "customer", "employee", "contact"],
  },
];

export function routeForEntity(
  actionId: ActionDef["id"],
  kind: string | undefined,
  opts?: { entityId?: string; amount?: number | null; label?: string | null },
): string {
  const isUuid = (id?: string) => !!id && /^[0-9a-f-]{36}$/i.test(id);

  if (actionId === "open_entity") {
    if (kind === "customer") {
      return isUuid(opts?.entityId)
        ? `/customers/${opts!.entityId}`
        : "/customers";
    }
    if (kind === "employee") return "/hr";
    return isUuid(opts?.entityId)
      ? `/suppliers/${opts!.entityId}`
      : "/suppliers";
  }

  if (actionId === "ap_payment") {
    const qs = new URLSearchParams();
    qs.set("source", "authority_x");
    qs.set("create", "1");
    if (isUuid(opts?.entityId)) qs.set("supplierId", opts!.entityId!);
    if (opts?.amount != null) qs.set("amount", String(opts.amount));
    if (opts?.label) qs.set("vendorName", opts.label);
    return `/finance/ap-bills?${qs.toString()}`;
  }

  if (actionId === "ar_payment") {
    const qs = new URLSearchParams();
    qs.set("source", "authority_x");
    qs.set("create", "1");
    if (isUuid(opts?.entityId)) qs.set("customerId", opts!.entityId!);
    if (opts?.amount != null) qs.set("amount", String(opts.amount));
    if (opts?.label) qs.set("customerName", opts.label);
    return `/finance/payments?${qs.toString()}`;
  }

  if (actionId === "transfer") {
    // CREATE_TRANSFER absent — Soft Glass banking only (pending Treasury)
    return "/finance/banking?source=authority_x&note=treasury_pending";
  }

  const def = ACTION_REGISTRY.find((a) => a.id === actionId);
  return def?.route ?? "/";
}
