export type ProductStatus = "DRAFT" | "ACTIVE" | "OBSOLETE";

export type Product = {
  id: string;
  companyId: string;
  sku: string;
  name: string;
  typeKey: string;
  uom: string;
  trackLot: boolean;
  perishable: boolean;
  shelfLifeDays: number | null;
  productionOffsetDays: number | null;
  storageClassKey: string;
  allergenFlags: string[];
  status: ProductStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductListResponse = {
  items: Product[];
  nextCursor: string | null;
};

export type RefKind =
  | "product_type"
  | "uom"
  | "storage_class"
  | "allergen";

export type RefValue = {
  kind: RefKind;
  code: string;
  label: string;
  sort: number;
  enabled: boolean;
};

export type ProductWriteBody = {
  sku?: string;
  name: string;
  typeKey: string;
  uom: string;
  trackLot: boolean;
  perishable: boolean;
  shelfLifeDays?: number | null;
  productionOffsetDays?: number | null;
  storageClassKey: string;
  allergenFlags: string[];
  version?: number;
};

export const STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Actif",
  OBSOLETE: "Obsolète",
};

export async function fetchRefs(kind?: RefKind): Promise<
  | { ok: true; items: RefValue[] }
  | { ok: false; status: number; message: string }
> {
  try {
    const url = kind
      ? `/api/v1/master-data/refs?kind=${encodeURIComponent(kind)}`
      : "/api/v1/master-data/refs";
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      return {
        ok: false,
        status: res.status,
        message: body.message ?? `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as { items: RefValue[] };
    return { ok: true, items: data.items };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchProducts(q?: string): Promise<
  | { ok: true; data: ProductListResponse }
  | { ok: false; status: number; code?: string; message: string }
> {
  try {
    const url = q?.trim()
      ? `/api/v1/products?q=${encodeURIComponent(q.trim())}`
      : "/api/v1/products";
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      return {
        ok: false,
        status: res.status,
        code: body.code,
        message: body.message ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, data: (await res.json()) as ProductListResponse };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchProduct(id: string): Promise<
  | { ok: true; data: Product }
  | { ok: false; status: number; code?: string; message: string }
> {
  try {
    const res = await fetch(`/api/v1/products/${encodeURIComponent(id)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      return {
        ok: false,
        status: res.status,
        code: body.code,
        message: body.message ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, data: (await res.json()) as Product };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createProduct(
  body: Omit<ProductWriteBody, "version"> & { sku: string },
): Promise<
  | { ok: true; data: Product }
  | { ok: false; status: number; code?: string; message: string }
> {
  return mutateProduct("POST", "/api/v1/products", body);
}

export async function updateProduct(
  id: string,
  body: ProductWriteBody & { version: number },
): Promise<
  | { ok: true; data: Product }
  | { ok: false; status: number; code?: string; message: string }
> {
  const { sku: _sku, ...patch } = body;
  void _sku;
  return mutateProduct("PATCH", `/api/v1/products/${id}`, patch);
}

export async function activateProduct(id: string): Promise<
  | { ok: true; data: Product }
  | { ok: false; status: number; code?: string; message: string }
> {
  return mutateProduct("POST", `/api/v1/products/${id}/activate`, undefined);
}

export async function archiveProduct(id: string): Promise<
  | { ok: true }
  | { ok: false; status: number; code?: string; message: string }
> {
  try {
    const res = await fetch(`/api/v1/products/${id}`, {
      method: "DELETE",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      return {
        ok: false,
        status: res.status,
        code: body.code,
        message: body.message ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type FiscalOverrideMode = "AUTO" | "ALWAYS" | "NEVER" | "CONFIRM";

export const FISCAL_OVERRIDE_LABELS: Record<FiscalOverrideMode, string> = {
  AUTO: "Auto (règle)",
  ALWAYS: "Toujours",
  NEVER: "Jamais (exonération)",
  CONFIRM: "Confirmer",
};

export type ProductFiscalCode = {
  id: string;
  code: string;
  label: string;
  kind: string;
  status: string;
  active: boolean;
};

export type ProductFiscalProfile = {
  id: string | null;
  defaultVatTaxCodeId: string | null;
  defaultVatCode: string | null;
  hsCode: string | null;
  fiscalCategory: string | null;
  notes: string | null;
  version: number;
};

export type ProductFiscalOverride = {
  id: string;
  taxCodeId: string;
  taxCode: string;
  taxLabel: string;
  kind: string;
  ruleStatus: string;
  mode: FiscalOverrideMode;
  source: string;
  validFrom: string | null;
  validTo: string | null;
  justification: string | null;
  reference: string | null;
  documentId: string | null;
  comment: string | null;
  version: number;
};

export type ProductFiscal = {
  productId: string;
  sku: string;
  profile: ProductFiscalProfile;
  overrides: ProductFiscalOverride[];
  availableCodes: ProductFiscalCode[];
};

type ProductApiError = {
  ok: false;
  status: number;
  code?: string;
  message: string;
};

async function parseProductError(res: Response): Promise<ProductApiError> {
  const body = (await res.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
  };
  return {
    ok: false,
    status: res.status,
    code: body.code,
    message: body.message ?? `HTTP ${res.status}`,
  };
}

export async function fetchProductFiscal(
  productId: string,
): Promise<{ ok: true; data: ProductFiscal } | ProductApiError> {
  try {
    const res = await fetch(`/api/v1/products/${productId}/fiscal`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseProductError(res);
    return { ok: true, data: (await res.json()) as ProductFiscal };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function upsertProductFiscalProfile(
  productId: string,
  body: {
    defaultVatTaxCodeId?: string | null;
    hsCode?: string | null;
    fiscalCategory?: string | null;
    notes?: string | null;
    version?: number;
  },
): Promise<{ ok: true; data: ProductFiscal } | ProductApiError> {
  try {
    const res = await fetch(`/api/v1/products/${productId}/fiscal`, {
      method: "PUT",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseProductError(res);
    return { ok: true, data: (await res.json()) as ProductFiscal };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function upsertProductFiscalOverride(
  productId: string,
  body: {
    taxCodeId: string;
    mode: FiscalOverrideMode;
    source?: string;
    justification?: string | null;
    reference?: string | null;
    version?: number;
  },
): Promise<{ ok: true; data: ProductFiscal } | ProductApiError> {
  try {
    const res = await fetch(
      `/api/v1/products/${productId}/fiscal/overrides`,
      {
        method: "PUT",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) return parseProductError(res);
    return { ok: true, data: (await res.json()) as ProductFiscal };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function deleteProductFiscalOverride(
  productId: string,
  taxCodeId: string,
): Promise<{ ok: true; data: ProductFiscal } | ProductApiError> {
  try {
    const res = await fetch(
      `/api/v1/products/${productId}/fiscal/overrides/${taxCodeId}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!res.ok) return parseProductError(res);
    return { ok: true, data: (await res.json()) as ProductFiscal };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

async function mutateProduct(
  method: string,
  url: string,
  body: unknown,
): Promise<
  | { ok: true; data: Product }
  | { ok: false; status: number; code?: string; message: string }
> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as {
        code?: string;
        message?: string;
      };
      return {
        ok: false,
        status: res.status,
        code: errBody.code,
        message: errBody.message ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, data: (await res.json()) as Product };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}
