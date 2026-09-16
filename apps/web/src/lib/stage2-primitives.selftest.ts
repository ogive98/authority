/**
 * Stage 2 — Soft Glass canonical primitives smoke check.
 * Run: npx tsx --tsconfig tsconfig.json src/lib/stage2-primitives.selftest.ts
 */
import assert from "node:assert/strict";
import { ADialog } from "../components/a/a-dialog";
import { APagination } from "../components/a/a-pagination";
import {
  ASoftTable,
  ASoftTd,
  ASoftTh,
} from "../components/a/a-soft-table";
import { ATabs } from "../components/a/a-tabs";
import { AConfirmDialog } from "../components/a/a-confirm-dialog";

assert.equal(typeof ADialog, "function");
assert.equal(typeof ATabs, "function");
assert.equal(typeof APagination, "function");
assert.equal(typeof ASoftTable, "function");
assert.equal(typeof ASoftTh, "function");
assert.equal(typeof ASoftTd, "function");
assert.equal(typeof AConfirmDialog, "function");
console.log("stage2-primitives.selftest: OK");
