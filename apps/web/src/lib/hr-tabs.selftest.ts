import assert from "node:assert/strict";
import { parseHrTab, hrTabHref, hrEmployeeHref } from "./hr-tabs";

assert.equal(parseHrTab("", ""), "employees");
assert.equal(parseHrTab("tab=postes", ""), "postes");
assert.equal(parseHrTab("?tab=bulletins", ""), "bulletins");
assert.equal(parseHrTab("", "#postes"), "postes");
assert.equal(parseHrTab("", "#bulletins"), "bulletins");
assert.equal(parseHrTab("tab=employees", "#postes"), "employees");
assert.equal(hrTabHref("employees"), "/hr");
assert.equal(hrTabHref("postes"), "/hr?tab=postes");
assert.equal(hrEmployeeHref("abc"), "/hr/employees/abc");

console.log("hr-tabs.selftest ok");
