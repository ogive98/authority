import assert from "node:assert/strict";
import { HOME_WIDGETS, SHELL_WIDGETS, sortWidgets } from "./widget-catalog";

assert.ok(SHELL_WIDGETS.some((w) => w.boom));
assert.ok(SHELL_WIDGETS.some((w) => w.loadStrategy === "viewport"));
assert.ok(SHELL_WIDGETS.some((w) => w.loadStrategy === "immediate"));

assert.ok(
  HOME_WIDGETS.some(
    (w) => w.id === "hero-context" && w.loadStrategy === "immediate",
  ),
);
assert.ok(
  HOME_WIDGETS.some(
    (w) => w.id === "kpi-strip" && w.loadStrategy === "immediate",
  ),
);
assert.ok(
  HOME_WIDGETS.filter((w) => w.loadStrategy === "viewport").length >= 5,
  "Mission Control below-fold widgets should be viewport-lazy (D296)",
);

assert.ok(
  HOME_WIDGETS.some(
    (w) => w.id === "backup-status" && w.contexts.includes("module:backup"),
  ),
  "Backup Mission Control widget (D310)",
);

const sorted = sortWidgets(SHELL_WIDGETS, ["boom", "monitor"]);
assert.equal(sorted[0]?.id, "boom");
assert.equal(sorted[1]?.id, "monitor");
assert.equal(sorted.length, SHELL_WIDGETS.length);

console.log("widget-catalog OK");
