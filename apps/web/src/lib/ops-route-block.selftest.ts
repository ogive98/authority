import assert from "node:assert/strict";
import { featureHideKey, OPS_VISIBILITY_DEFAULTS } from "./ops-visibility";
import {
  longestMatchingFeature,
  resolveOpsRouteBlock,
  resolveRegistryRouteBlock,
} from "./ops-route-block";
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
    {
      key: "hr",
      name: "RH",
      features: [
        { id: "hr-employees", label: "Employés", href: "/hr" },
        { id: "hr-job-titles", label: "Postes", href: "/hr?tab=postes" },
        { id: "hr-bulletins", label: "Bulletins", href: "/hr?tab=bulletins" },
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

assert.equal(
  longestMatchingFeature(registry, {
    pathname: "/hr",
    search: "?tab=postes",
    hash: "",
  })?.feature.id,
  "hr-job-titles",
);
assert.equal(
  longestMatchingFeature(registry, {
    pathname: "/hr",
    search: "",
    hash: "",
  })?.feature.id,
  "hr-employees",
);

assert.equal(
  resolveRegistryRouteBlock(
    { pathname: "/sales", search: "", hash: "" },
    registry,
  )?.reason,
  "module-inactive",
);
assert.equal(
  resolveRegistryRouteBlock(
    { pathname: "/delivery", search: "", hash: "" },
    registry,
  ),
  null,
);
assert.equal(
  resolveRegistryRouteBlock(
    { pathname: "/help", search: "", hash: "" },
    registry,
  ),
  null,
);
assert.equal(
  resolveRegistryRouteBlock(
    { pathname: "/sales", search: "", hash: "" },
    { ...registry, companyId: null },
  ),
  null,
);

console.log("ops-route-block OK");
