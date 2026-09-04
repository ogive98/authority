import assert from "node:assert/strict";
import {
  SA_HOME_PATH,
  SA_LOGIN_PATH,
  SA_NAV,
  shouldHideSuperAdminPortal,
} from "./super-admin-portal";

assert.equal(SA_LOGIN_PATH, "/super-admin/login");
assert.equal(SA_HOME_PATH, "/super-admin");
assert.ok(shouldHideSuperAdminPortal(401));
assert.ok(shouldHideSuperAdminPortal(403));
assert.ok(shouldHideSuperAdminPortal(404));
assert.ok(shouldHideSuperAdminPortal(503));
assert.equal(shouldHideSuperAdminPortal(200), false);
assert.ok(!SA_NAV.some((i) => i.href.includes("preview")));
assert.ok(SA_NAV.every((i) => i.href.startsWith("/super-admin")));

console.log("super-admin portal gate OK");
