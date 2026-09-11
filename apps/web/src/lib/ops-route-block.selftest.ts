import assert from "node:assert/strict";
import { featureHideKey, OPS_VISIBILITY_DEFAULTS } from "./ops-visibility";
import { resolveOpsRouteBlock } from "./ops-route-block";
import type { MeRegistry } from "./registry";

const registry: MeRegistry = {
  companyId: "c1",
  modules: [
    {
      key: "delivery",
      name: "Livraison",
      features: [{ id: "shipments", label: "BL", href: "/delivery" }],
    },
    {
      key: "finance",
      name: "Finance",
      features: [
        { id: "open-items", label: "Créances", href: "/finance" },
        { id: "banking", label: "Banque", href: "/finance/banking" },
      ],
    },
    {
      key: "accounting",
      name: "Comptabilité",
      features: [
        { id: "coa", label: "Plan comptable", href: "/accounting" },
        { id: "entries", label: "Écritures", href: "/accounting?tab=entries" },
      ],
    },
  ],
  flags: [],
};

assert.equal(
  resolveOpsRouteBlock(
    { pathname: "/delivery", search: "", hash: "" },
    registry,
    {
      ghostEnabled: true,
      patchEnabled: false,
      prefs: { ...OPS_VISIBILITY_DEFAULTS, ghostHideDelivery: true },
    },
  )?.reason,
  "delivery",
);

const ghostBank = {
  ghostEnabled: true,
  patchEnabled: false,
  prefs: {
    ...OPS_VISIBILITY_DEFAULTS,
    ghostHideDelivery: false,
    ghostHiddenFeatures: [featureHideKey("finance", "banking")],
  },
};
assert.equal(
  resolveOpsRouteBlock(
    { pathname: "/finance/banking", search: "", hash: "" },
    registry,
    ghostBank,
  )?.reason,
  "ghost-feature",
);
assert.equal(
  resolveOpsRouteBlock(
    { pathname: "/finance", search: "", hash: "" },
    registry,
    ghostBank,
  ),
  null,
);

assert.equal(
  resolveOpsRouteBlock(
    { pathname: "/accounting", search: "?tab=entries", hash: "" },
    registry,
    {
      ghostEnabled: false,
      patchEnabled: true,
      prefs: {
        ...OPS_VISIBILITY_DEFAULTS,
        patchHideDelivery: false,
        patchAccountingPartial: true,
        patchAccountingPreset: "partial",
      },
    },
  )?.reason,
  "accounting-partial",
);

console.log("ops-route-block OK");
