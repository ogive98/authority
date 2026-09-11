import {
  filterEntriesByPatchRules,
  featureHideKey,
  filterRegistryForOpsModes,
  OPS_VISIBILITY_DEFAULTS,
} from "./ops-visibility";
import type { MeRegistry } from "./registry";

describe("ops-visibility D203", () => {
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
          { id: "banking", label: "Banque", href: "/finance/banking" },
          { id: "invoices", label: "Factures", href: "/finance/invoices" },
        ],
      },
    ],
    flags: [],
  };

  it("hides ghost checklist features", () => {
    const filtered = filterRegistryForOpsModes(registry, {
      ghostEnabled: true,
      patchEnabled: false,
      prefs: {
        ...OPS_VISIBILITY_DEFAULTS,
        ghostHideDelivery: false,
        ghostHiddenFeatures: [featureHideKey("finance", "banking")],
      },
    });
    const finance = filtered.modules.find((m) => m.key === "finance");
    expect(finance?.features.map((f) => f.id)).toEqual(["invoices"]);
  });

  it("filters entries by PATCH intensity and rules", () => {
    const entries = [
      { id: "a", entryDate: "2026-01-01", totalDebit: "10" },
      { id: "b", entryDate: "2026-02-01", totalDebit: "900" },
      { id: "c", entryDate: "2026-03-01", totalDebit: "50" },
    ];
    const out = filterEntriesByPatchRules(entries, {
      patchEnabled: true,
      intensity: 40,
      rules: ["large_moves"],
    });
    expect(out).toHaveLength(2);
    expect(out[0]?.id).toBe("b");
  });
});
