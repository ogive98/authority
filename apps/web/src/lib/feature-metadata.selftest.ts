/**
 * FeatureMetadata selftest (D278/D279) — Soft Glass Track A + FORGE bridge.
 * Run: npx tsx --tsconfig tsconfig.json src/lib/feature-metadata.selftest.ts
 */
import assert from "node:assert/strict";
import {
  buildFeatureMetadataCatalog,
  enrichmentsFromForgeMetadataBridge,
  featureMetadataCoverage,
  getFeatureMetadata,
  searchFeatureMetadata,
  searchFeatureMetadataWithOverlays,
} from "./feature-metadata";

const catalog = buildFeatureMetadataCatalog("fr");
assert.ok(catalog.length > 5, "catalog must come from ACTION_REGISTRY");
assert.ok(getFeatureMetadata("nav-home"), "nav-home required");
assert.ok(getFeatureMetadata("nav-forge"), "nav-forge enrichment required");
assert.ok(getFeatureMetadata("nav-delivery"), "nav-delivery enrichment required");
assert.ok(getFeatureMetadata("nav-hr"), "nav-hr enrichment required");

const forgeHits = searchFeatureMetadata("personnalisation", "fr");
assert.ok(
  forgeHits.some((h) => h.id === "nav-forge"),
  "alias personnalisation → nav-forge",
);

const coverage = featureMetadataCoverage();
assert.ok(coverage.catalogSize >= coverage.enriched);
assert.ok(
  coverage.enriched >= 12,
  `expected progressive enrichments, got ${coverage.enriched}`,
);
assert.ok(getFeatureMetadata("nav-suppliers"), "nav-suppliers enrichment");
assert.ok(getFeatureMetadata("nav-tax"), "nav-tax enrichment");
assert.ok(getFeatureMetadata("nav-tej-center"), "nav-tej-center enrichment");

const overlays = enrichmentsFromForgeMetadataBridge([
  {
    status: "ACTIVE",
    schemaJson: {
      commandId: "nav-sales",
      aliases: ["température-camion"],
    },
  },
  {
    status: "DRAFT",
    schemaJson: { commandId: "nav-sales", aliases: ["ignored-draft"] },
  },
]);
const bridged = searchFeatureMetadataWithOverlays(
  "température-camion",
  "fr",
  10,
  overlays,
);
assert.ok(
  bridged.some((h) => h.id === "nav-sales"),
  "ACTIVE forge bridge alias → nav-sales",
);
const ignored = searchFeatureMetadataWithOverlays(
  "ignored-draft",
  "fr",
  10,
  overlays,
);
assert.equal(
  ignored.some((h) => h.id === "nav-sales"),
  false,
  "DRAFT forge metadata must not bridge",
);

console.log(
  `feature-metadata.selftest OK catalog=${coverage.catalogSize} enriched=${coverage.enriched}`,
);
