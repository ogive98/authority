import assert from "node:assert/strict";
import {
  COMMAND_CATALOG,
  DEMO_ENABLED_MODULES,
  DEMO_PERMISSION_GRANTS,
  filterCommands,
} from "./command-catalog";

const all = filterCommands(COMMAND_CATALOG, {
  query: "",
  grants: DEMO_PERMISSION_GRANTS,
  enabledModules: DEMO_ENABLED_MODULES,
});

assert.ok(!all.some((c) => c.id === "act-payroll-export"));
assert.ok(all.some((c) => c.id === "nav-home"));
assert.ok(all.some((c) => c.id === "search-lot"));

const q = filterCommands(COMMAND_CATALOG, {
  query: "brie",
  grants: DEMO_PERMISSION_GRANTS,
  enabledModules: DEMO_ENABLED_MODULES,
});
assert.equal(q.length, 1);
assert.equal(q[0]?.id, "search-lot");

/** Registry-trusted: module on → permissionKey UX ok; payroll module off → hidden. */
const trusted = filterCommands(COMMAND_CATALOG, {
  query: "",
  enabledModules: DEMO_ENABLED_MODULES,
});
assert.ok(trusted.some((c) => c.id === "nav-sales"));
assert.ok(!trusted.some((c) => c.id === "act-payroll-export"));

const noModules = filterCommands(COMMAND_CATALOG, {
  query: "",
  enabledModules: new Set(["home"]),
});
assert.ok(noModules.some((c) => c.id === "nav-home"));
assert.ok(!noModules.some((c) => c.id === "nav-sales"));

console.log("command-catalog filter OK");
