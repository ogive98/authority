"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBusinessContext } from "@/lib/business-auth";
import {
  fetchActiveProducts,
  fetchWarehouses,
  type ProductOption,
  type WarehouseOption,
} from "@/lib/production";
import { fetchSupplierOptions, type SupplierOption } from "@/lib/procurement";

export type SiteOption = { id: string; code: string };

export type ProcurementMeta = {
  products: ProductOption[];
  warehouses: WarehouseOption[];
  suppliers: SupplierOption[];
  sites: SiteOption[];
  siteId: string | null;
  ready: boolean;
};

async function fetchSites(companyId: string | null): Promise<SiteOption[]> {
  if (!companyId) return [];
  const res = await fetch(`/api/v1/organization/companies/${companyId}/sites`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ id: string; code: string }>;
  return Array.isArray(data) ? data.map((s) => ({ id: s.id, code: s.code })) : [];
}

/** One-shot master-data load shared by every procurement panel. */
export function useProcurementMeta(): ProcurementMeta {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const [pr, wh, sup, ctx] = await Promise.all([
      fetchActiveProducts(),
      fetchWarehouses(),
      fetchSupplierOptions(),
      fetchBusinessContext(),
    ]);
    if (pr.ok) setProducts(pr.data.items);
    if (wh.ok) setWarehouses(wh.data.items);
    if (sup.ok) setSuppliers(sup.data.items);
    if (ctx.ok) {
      setSiteId(ctx.data.siteId);
      setSites(await fetchSites(ctx.data.companyId));
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { products, warehouses, suppliers, sites, siteId, ready };
}

export function productLabel(products: ProductOption[], productId: string): string {
  const found = products.find((p) => p.id === productId);
  return found ? `${found.sku} · ${found.name}` : productId.slice(0, 8);
}

export function warehouseLabel(
  warehouses: WarehouseOption[],
  warehouseId: string | null,
): string {
  if (!warehouseId) return "—";
  const found = warehouses.find((w) => w.id === warehouseId);
  return found ? found.code : warehouseId.slice(0, 8);
}

export function siteLabel(sites: SiteOption[], siteId: string | null): string {
  if (!siteId) return "—";
  return sites.find((s) => s.id === siteId)?.code ?? siteId.slice(0, 8);
}

export function toneFor(
  status: string,
): "neutral" | "accent" | "success" | "warning" | "danger" {
  switch (status) {
    case "RECEIVED":
    case "POSTED":
    case "APPROVED":
    case "CONFIRMED":
    case "CONVERTED":
    case "CLOSED":
      return "success";
    case "SENT":
    case "SUBMITTED":
    case "PARTIAL":
      return "accent";
    case "CANCELLED":
    case "REJECTED":
      return "danger";
    case "DRAFT":
    case "OPEN":
      return "warning";
    default:
      return "neutral";
  }
}
