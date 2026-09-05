import type { PortalDelivery } from "@/lib/customer-portal";

/** Stub livraison « En route » — pour démo visuelle du schéma parcours. */
export const PORTAL_JOURNEY_STUB: PortalDelivery = {
  id: "00000000-0000-4000-8000-0000000000stub",
  number: "DLV-DEMO-001",
  orderId: "00000000-0000-4000-8000-0000000000ord",
  orderNumber: "SO-DEMO-VISUEL",
  status: "OUT",
  driverLabel: "Karim Ben Salah",
  failReason: null,
  assignedAt: "2026-09-05T08:15:00.000Z",
  dispatchedAt: "2026-09-05T09:40:00.000Z",
  completedAt: null,
  createdAt: "2026-09-05T07:50:00.000Z",
};

/** Variante échec — pour basculer l’exemple. */
export const PORTAL_JOURNEY_STUB_FAILED: PortalDelivery = {
  ...PORTAL_JOURNEY_STUB,
  id: "00000000-0000-4000-8000-0000000000fail",
  number: "DLV-DEMO-FAIL",
  status: "FAILED",
  failReason: "Client absent — 2e passage prévu",
  completedAt: "2026-09-05T11:05:00.000Z",
};
