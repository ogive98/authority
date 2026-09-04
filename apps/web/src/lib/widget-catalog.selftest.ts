import assert from "node:assert/strict";
import { SHELL_WIDGETS, sortWidgets } from "./widget-catalog";

assert.ok(SHELL_WIDGETS.some((w) => w.boom));
assert.ok(SHELL_WIDGETS.some((w) => w.loadStrategy === "viewport"));
assert.ok(SHELL_WIDGETS.some((w) => w.loadStrategy === "immediate"));

const sorted = sortWidgets(SHELL_WIDGETS, ["boom", "monitor"]);
assert.equal(sorted[0]?.id, "boom");
assert.equal(sorted[1]?.id, "monitor");
assert.equal(sorted.length, SHELL_WIDGETS.length);

console.log("widget-catalog OK");
