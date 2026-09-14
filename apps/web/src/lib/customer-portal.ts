export const PORTAL_LOGIN_PATH = "/portal/login";
export const PORTAL_HOME_PATH = "/portal";
export const PORTAL_ORDERS_PATH = "/portal/orders";
export const PORTAL_ORDERS_NEW_PATH = "/portal/orders/new";
export const PORTAL_DELIVERIES_PATH = "/portal/deliveries";
export const PORTAL_FINANCE_PATH = "/portal/finance";
export const PORTAL_FINANCE_INVOICES_PATH = "/portal/finance/invoices";
export const PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH =
  "/portal/finance/payment-declarations";
export const PORTAL_CLAIMS_PATH = "/portal/claims";
export const PORTAL_DOCUMENTS_PATH = "/portal/documents";
export const PORTAL_SALUBRITA_PATH = "/portal/salubrita";
export const PORTAL_COOKIE_NAME = "authority_customer_portal_session";

export const PORTAL_API = {
  login: "/api/v1/customer-portal/auth/login",
  logout: "/api/v1/customer-portal/auth/logout",
  me: "/api/v1/customer-portal/me",
  dashboard: "/api/v1/customer-portal/dashboard",
  insights: "/api/v1/customer-portal/insights",
  catalog: "/api/v1/customer-portal/catalog",
  orders: "/api/v1/customer-portal/orders",
  deliveries: "/api/v1/customer-portal/deliveries",
  financeOpenItems: "/api/v1/customer-portal/finance/open-items",
  financeInvoices: "/api/v1/customer-portal/finance/invoices",
  financeCredit: "/api/v1/customer-portal/finance/credit",
  financePaymentDeclarations:
    "/api/v1/customer-portal/finance/payment-declarations",
  claims: "/api/v1/customer-portal/claims",
  documents: "/api/v1/customer-portal/documents",
  salubritaCertificates: "/api/v1/customer-portal/salubrita/certificates",
} as const;

export type PortalMe = {
  user: {
    id: string;
    email: string;
    displayName: string;
    status: string;
    locale: string;
    timezone: string;
    mfaEnabled: boolean;
  };
  membership: {
    id: string;
    customerId: string;
    companyId: string;
    role: string;
    status: string;
  };
  customer: {
    id: string;
    code: string;
    legalName: string;
    blocked: boolean;
  };
  realm: "customer_portal";
};

export type PortalInsightSeverity = "info" | "warn" | "critical";

export type PortalInsightType =
  | "CREDIT_PRESSURE"
  | "OVERDUE_OPEN_ITEM"
  | "REORDER_DUE"
  | "OPEN_CLAIMS"
  | "DELIVERY_FAILED";

export type PortalInsight = {
  id: string;
  type: PortalInsightType;
  severity: PortalInsightSeverity;
  title: string;
  message: string;
  href: string;
  evidence: Record<string, unknown>;
};

export type PortalDashboard = {
  kpis: {
    openOrders: number;
    pendingDeliveries: number;
    outstandingBalance: number | null;
    openClaims?: number;
  };
  insights?: PortalInsight[];
  sections: string[];
  message: string;
};

export type PortalOrderStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export type PortalOrderLine = {
  sku: string | null;
  name: string | null;
  qty: string;
  unitPrice: string;
  lineTotal: string;
};

export type PortalOrder = {
  id: string;
  number: string;
  status: PortalOrderStatus;
  requestedDate: string | null;
  currency: string;
  amountTotal: string;
  preferredDriver: string | null;
  confirmedAt: string | null;
  createdAt: string;
  lines: PortalOrderLine[];
};

export type PortalOrderList = {
  items: PortalOrder[];
  nextCursor: string | null;
};

export type PortalCatalogItem = {
  id: string;
  sku: string;
  name: string;
  uom: string;
  lastUnitPrice: string | null;
  currency: string;
};

export type PortalCatalogList = {
  items: PortalCatalogItem[];
  nextCursor: string | null;
};

export type PortalDeliveryStatus =
  | "READY"
  | "ASSIGNED"
  | "OUT"
  | "DELIVERED"
  | "FAILED";

export type PortalDelivery = {
  id: string;
  number: string;
  orderId: string;
  orderNumber: string | null;
  status: PortalDeliveryStatus;
  driverLabel: string | null;
  failReason: string | null;
  assignedAt: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type PortalDeliveryList = {
  items: PortalDelivery[];
  nextCursor: string | null;
};

export type PortalOpenItemStatus = "OPEN" | "PARTIAL" | "CLOSED";

export type PortalOpenItem = {
  id: string;
  number: string;
  status: PortalOpenItemStatus;
  currency: string;
  amountTotal: string;
  amountOpen: string;
  dueDate: string | null;
  label: string | null;
  createdAt: string;
  allocations: {
    amount: string;
    paidAt: string;
    note: string | null;
  }[];
};

export type PortalOpenItemList = {
  items: PortalOpenItem[];
  nextCursor: string | null;
};

export type PortalInvoiceStatus = "ISSUED" | "CANCELLED";

export type PortalInvoice = {
  id: string;
  number: string;
  status: PortalInvoiceStatus;
  currency: string;
  amountTotal: string;
  dueDate: string | null;
  issuedAt: string | null;
  label: string | null;
  createdAt: string;
  openItemId: string | null;
};

export type PortalInvoiceList = {
  items: PortalInvoice[];
  nextCursor: string | null;
};

export type PortalPaymentDeclarationStatus =
  | "SUBMITTED"
  | "ACKNOWLEDGED"
  | "REJECTED"
  | "CANCELLED";

export type PortalPaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CARD"
  | "CHEQUE"
  | "BILL_OF_EXCHANGE"
  | "OTHER";

export type PortalPaymentDeclaration = {
  id: string;
  number: string;
  amount: string;
  currency: string;
  method: PortalPaymentMethod;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  openItemId: string | null;
  status: PortalPaymentDeclarationStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type PortalPaymentDeclarationList = {
  items: PortalPaymentDeclaration[];
  nextCursor: string | null;
};

export type PortalCredit = {
  creditLimit: string | null;
  outstandingBalance: string;
  currency: string;
};

export type PortalClaimType =
  | "DELIVERY"
  | "QUALITY"
  | "QUANTITY"
  | "BILLING"
  | "OTHER";

export type PortalClaimStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "ACTION_REQUIRED"
  | "RESOLVED"
  | "CLOSED";

export type PortalClaim = {
  id: string;
  number: string;
  type: PortalClaimType;
  status: PortalClaimStatus;
  subject: string;
  description: string;
  orderId: string | null;
  orderNumber: string | null;
  shipmentId: string | null;
  shipmentNumber: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PortalClaimList = {
  items: PortalClaim[];
  nextCursor: string | null;
};

/**
 * True when Customer Portal session is missing/invalid (redirect to login).
 * Do NOT treat 503/timeout as logout — Nest watch restarts are transient.
 */
export function shouldHidePortal(httpStatus: number): boolean {
  return httpStatus === 401 || httpStatus === 403;
}

/** API unreachable — keep cookie, show retry (not login). */
export function isPortalApiUnavailable(httpStatus: number): boolean {
  return httpStatus === 503 || httpStatus === 502 || httpStatus === 504;
}

function apiOrigin(): string {
  return process.env.AUTHORITY_API_ORIGIN ?? "http://127.0.0.1:3001";
}

async function cookieHeader(): Promise<string> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

async function portalFetch<T>(
  path: string,
): Promise<{ status: number; data: T | null }> {
  try {
    const res = await fetch(`${apiOrigin()}${path}`, {
      headers: {
        Accept: "application/json",
        cookie: await cookieHeader(),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return { status: res.status, data: null };
    }
    const data = (await res.json()) as T;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: null };
  }
}

export async function fetchPortalMe(): Promise<{
  status: number;
  data: PortalMe | null;
}> {
  return portalFetch<PortalMe>(PORTAL_API.me);
}

export async function fetchPortalDashboard(): Promise<{
  status: number;
  data: PortalDashboard | null;
}> {
  return portalFetch<PortalDashboard>(PORTAL_API.dashboard);
}

export async function fetchOrders(opts?: {
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ status: number; data: PortalOrderList | null }> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return portalFetch<PortalOrderList>(
    `${PORTAL_API.orders}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchOrder(
  id: string,
): Promise<{ status: number; data: PortalOrder | null }> {
  return portalFetch<PortalOrder>(`${PORTAL_API.orders}/${id}`);
}

export async function fetchCatalog(opts?: {
  q?: string;
  limit?: number;
}): Promise<{ status: number; data: PortalCatalogList | null }> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return portalFetch<PortalCatalogList>(
    `${PORTAL_API.catalog}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchDeliveries(opts?: {
  q?: string;
  status?: string;
  orderId?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ status: number; data: PortalDeliveryList | null }> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.status) params.set("status", opts.status);
  if (opts?.orderId) params.set("orderId", opts.orderId);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return portalFetch<PortalDeliveryList>(
    `${PORTAL_API.deliveries}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchDelivery(
  id: string,
): Promise<{ status: number; data: PortalDelivery | null }> {
  return portalFetch<PortalDelivery>(`${PORTAL_API.deliveries}/${id}`);
}

export async function fetchPortalOpenItems(opts?: {
  q?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ status: number; data: PortalOpenItemList | null }> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return portalFetch<PortalOpenItemList>(
    `${PORTAL_API.financeOpenItems}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchPortalOpenItem(
  id: string,
): Promise<{ status: number; data: PortalOpenItem | null }> {
  return portalFetch<PortalOpenItem>(`${PORTAL_API.financeOpenItems}/${id}`);
}

export async function fetchPortalCredit(): Promise<{
  status: number;
  data: PortalCredit | null;
}> {
  return portalFetch<PortalCredit>(PORTAL_API.financeCredit);
}

export async function fetchPortalInvoices(opts?: {
  q?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ status: number; data: PortalInvoiceList | null }> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return portalFetch<PortalInvoiceList>(
    `${PORTAL_API.financeInvoices}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchPortalInvoice(
  id: string,
): Promise<{ status: number; data: PortalInvoice | null }> {
  return portalFetch<PortalInvoice>(`${PORTAL_API.financeInvoices}/${id}`);
}

export async function fetchPortalPaymentDeclarations(opts?: {
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ status: number; data: PortalPaymentDeclarationList | null }> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return portalFetch<PortalPaymentDeclarationList>(
    `${PORTAL_API.financePaymentDeclarations}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchPortalPaymentDeclaration(
  id: string,
): Promise<{ status: number; data: PortalPaymentDeclaration | null }> {
  return portalFetch<PortalPaymentDeclaration>(
    `${PORTAL_API.financePaymentDeclarations}/${id}`,
  );
}

export async function fetchClaims(opts?: {
  q?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ status: number; data: PortalClaimList | null }> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return portalFetch<PortalClaimList>(
    `${PORTAL_API.claims}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchClaim(
  id: string,
): Promise<{ status: number; data: PortalClaim | null }> {
  return portalFetch<PortalClaim>(`${PORTAL_API.claims}/${id}`);
}

export type PortalDocument = {
  id: string;
  number: string;
  title: string;
  mime: string;
  size: string;
  linkType: string;
  linkId: string | null;
  createdAt: string;
};

export type PortalDocumentList = {
  items: PortalDocument[];
  nextCursor: string | null;
};

export async function fetchPortalDocuments(opts?: {
  q?: string;
  limit?: number;
  linkType?: string;
  linkId?: string;
}): Promise<{ status: number; data: PortalDocumentList | null }> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.linkType?.trim()) params.set("linkType", opts.linkType.trim());
  if (opts?.linkId?.trim()) params.set("linkId", opts.linkId.trim());
  const qs = params.toString();
  return portalFetch<PortalDocumentList>(
    `${PORTAL_API.documents}${qs ? `?${qs}` : ""}`,
  );
}

export type PortalSalubritaHistoryItem = {
  packDate: string;
  lineCount: number;
  updatedAt: string;
  source: "snapshot" | "live";
};

export type PortalSalubritaHistory = {
  days: number;
  fromDate: string;
  toDate: string;
  items: PortalSalubritaHistoryItem[];
};

export type PortalSalubritaCertificate = {
  packDate: string;
  warehouseId: string | null;
  source?: "snapshot" | "live";
  items: Array<{
    productId: string;
    productSku: string;
    productName: string;
    productionDate: string;
    packDate: string;
    dlc: string;
    daysAfterPack: number;
    lotCode: string | null;
    shelfLifeDays: number;
  }>;
};

export async function fetchPortalSalubritaHistory(): Promise<{
  status: number;
  data: PortalSalubritaHistory | null;
}> {
  return portalFetch<PortalSalubritaHistory>(PORTAL_API.salubritaCertificates);
}

export async function fetchPortalSalubritaCertificate(
  packDate: string,
): Promise<{ status: number; data: PortalSalubritaCertificate | null }> {
  return portalFetch<PortalSalubritaCertificate>(
    `${PORTAL_API.salubritaCertificates}/${encodeURIComponent(packDate)}`,
  );
}

/** Browser-side download (client components). Do not use portalFetch (next/headers). */
export async function fetchPortalDocumentDownloadClient(
  id: string,
): Promise<{
  status: number;
  downloadUrl: string | null;
}> {
  const res = await fetch(`${PORTAL_API.documents}/${id}/download`, {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    return { status: res.status, downloadUrl: null };
  }
  const body = (await res.json()) as { downloadUrl?: string };
  return { status: res.status, downloadUrl: body.downloadUrl ?? null };
}

export async function fetchPortalDocumentDownload(
  id: string,
): Promise<{
  status: number;
  data: {
    id: string;
    number: string;
    title: string;
    downloadUrl: string;
    expiresInSeconds: number;
  } | null;
}> {
  return portalFetch(`${PORTAL_API.documents}/${id}/download`);
}

export function portalClaimTypeLabel(type: PortalClaimType): string {
  if (type === "DELIVERY") return "Livraison";
  if (type === "QUALITY") return "Qualité";
  if (type === "QUANTITY") return "Quantité";
  if (type === "BILLING") return "Facturation";
  return "Autre";
}

export function portalClaimStatusLabel(status: PortalClaimStatus): string {
  if (status === "UNDER_REVIEW") return "En revue";
  if (status === "ACTION_REQUIRED") return "Action requise";
  if (status === "RESOLVED") return "Résolue";
  if (status === "CLOSED") return "Clôturée";
  return "Ouverte";
}

export function portalClaimBadgeTone(
  status: PortalClaimStatus,
): "success" | "warning" | "accent" | "neutral" | "info" {
  if (status === "RESOLVED" || status === "CLOSED") return "success";
  if (status === "ACTION_REQUIRED") return "warning";
  if (status === "UNDER_REVIEW") return "info";
  return "accent";
}

export function portalOrderStatusLabel(status: PortalOrderStatus): string {
  if (status === "CONFIRMED") return "Confirmée";
  if (status === "CANCELLED") return "Annulée";
  return "Brouillon";
}

export function portalOrderBadgeTone(
  status: PortalOrderStatus,
): "success" | "warning" | "neutral" {
  if (status === "CONFIRMED") return "success";
  if (status === "CANCELLED") return "warning";
  return "neutral";
}

export function portalDeliveryStatusLabel(
  status: PortalDeliveryStatus,
): string {
  if (status === "READY") return "Prêt";
  if (status === "ASSIGNED") return "Assigné";
  if (status === "OUT") return "En route";
  if (status === "DELIVERED") return "Livré";
  return "Échec";
}

export function portalDeliveryBadgeTone(
  status: PortalDeliveryStatus,
): "success" | "warning" | "accent" | "neutral" | "info" {
  if (status === "DELIVERED") return "success";
  if (status === "FAILED") return "warning";
  if (status === "OUT") return "accent";
  if (status === "ASSIGNED") return "info";
  return "neutral";
}

export function portalOpenItemStatusLabel(
  status: PortalOpenItemStatus,
): string {
  if (status === "CLOSED") return "Soldé";
  if (status === "PARTIAL") return "Partiel";
  return "Ouvert";
}

export function portalOpenItemBadgeTone(
  status: PortalOpenItemStatus,
): "success" | "warning" | "accent" | "neutral" {
  if (status === "CLOSED") return "success";
  if (status === "PARTIAL") return "warning";
  return "accent";
}

export function portalInvoiceStatusLabel(status: PortalInvoiceStatus): string {
  if (status === "CANCELLED") return "Annulée";
  return "Émise";
}

export function portalInvoiceBadgeTone(
  status: PortalInvoiceStatus,
): "success" | "warning" | "neutral" {
  if (status === "CANCELLED") return "warning";
  return "success";
}

export function portalPaymentDeclarationStatusLabel(
  status: PortalPaymentDeclarationStatus,
): string {
  if (status === "ACKNOWLEDGED") return "Prise en compte";
  if (status === "REJECTED") return "Refusée";
  if (status === "CANCELLED") return "Annulée";
  return "Soumise";
}

export function portalPaymentDeclarationBadgeTone(
  status: PortalPaymentDeclarationStatus,
): "success" | "warning" | "accent" | "neutral" | "danger" {
  if (status === "ACKNOWLEDGED") return "success";
  if (status === "SUBMITTED") return "accent";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

export function portalPaymentMethodLabel(method: PortalPaymentMethod): string {
  if (method === "CASH") return "Espèces";
  if (method === "BANK_TRANSFER") return "Virement";
  if (method === "CARD") return "Carte";
  if (method === "CHEQUE") return "Chèque";
  if (method === "BILL_OF_EXCHANGE") return "Traite";
  return "Autre";
}

export function portalInsightSeverityLabel(
  severity: PortalInsightSeverity,
): string {
  if (severity === "critical") return "Critique";
  if (severity === "warn") return "Attention";
  return "Info";
}

export function portalInsightBadgeTone(
  severity: PortalInsightSeverity,
): "danger" | "warning" | "info" {
  if (severity === "critical") return "danger";
  if (severity === "warn") return "warning";
  return "info";
}
