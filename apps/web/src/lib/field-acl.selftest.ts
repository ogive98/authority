import assert from "node:assert/strict";
import {
  FALLBACK_FIELD_ACL,
  FIELD_ACL_WAGE_KEY,
  isFieldVisible,
  type MeFieldAcl,
} from "./field-acl";

assert.equal(isFieldVisible(undefined, FIELD_ACL_WAGE_KEY), false);
assert.equal(isFieldVisible(FALLBACK_FIELD_ACL, FIELD_ACL_WAGE_KEY), false);

const granted: MeFieldAcl = {
  companyId: "co-1",
  fields: [
    {
      key: FIELD_ACL_WAGE_KEY,
      permissionKey: "hr.wage.read",
      visible: true,
    },
  ],
};
assert.equal(isFieldVisible(granted, FIELD_ACL_WAGE_KEY), true);

const omitted: MeFieldAcl = { companyId: "co-1", fields: [] };
assert.equal(isFieldVisible(omitted, FIELD_ACL_WAGE_KEY), false);

const amountWithoutAcl: MeFieldAcl = {
  companyId: "co-1",
  fields: [
    {
      key: FIELD_ACL_WAGE_KEY,
      permissionKey: "hr.wage.read",
      visible: false,
    },
  ],
};
assert.equal(isFieldVisible(amountWithoutAcl, "sales.amount"), false);

console.log("field-acl mask OK");
