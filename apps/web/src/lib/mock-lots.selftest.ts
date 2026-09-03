import assert from "node:assert/strict";
import { buildMockLots, pageLots } from "./mock-lots";

const all = buildMockLots(1000);
assert.equal(all.length, 1000);

const page1 = pageLots(all, { limit: 50 });
assert.equal(page1.items.length, 50);
assert.ok(page1.nextCursor);
assert.equal(page1.totalFiltered, 1000);

const page2 = pageLots(all, { cursor: page1.nextCursor, limit: 50 });
assert.equal(page2.items.length, 50);
assert.notEqual(page2.items[0]?.id, page1.items[0]?.id);

const capped = pageLots(all, { limit: 500 });
assert.equal(capped.items.length, 100);

const filtered = pageLots(all, {
  limit: 50,
  filter: { status: "quarantine" },
});
assert.ok(filtered.totalFiltered < 1000);
assert.ok(filtered.items.every((r) => r.status === "quarantine"));

console.log("mock-lots pagination OK");
