import assert from "node:assert/strict";
import {
  isEmployeePortalApiUnavailable,
  shouldHideEmployeePortal,
} from "./employee-portal";
import {
  isAuthApiUnavailable,
  shouldHideShell,
} from "./business-auth";

assert.ok(shouldHideShell(401));
assert.ok(shouldHideShell(403));
assert.equal(shouldHideShell(503), false);
assert.equal(shouldHideShell(200), false);
assert.ok(isAuthApiUnavailable(503));

assert.ok(shouldHideEmployeePortal(401));
assert.ok(shouldHideEmployeePortal(403));
assert.equal(shouldHideEmployeePortal(503), false);
assert.ok(isEmployeePortalApiUnavailable(503));

console.log("auth session gate OK");
