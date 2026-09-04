import assert from "node:assert/strict";
import {
  enqueueMockPrintJob,
  getMockPrintJob,
  resetMockPrintJobs,
} from "./print-job-mock";

resetMockPrintJobs();

const first = enqueueMockPrintJob({
  idempotencyKey: "print_same",
  documentId: "BL-1",
});
assert.ok(first.id.startsWith("prn_"));
assert.equal(first.queue, "print");
assert.equal(first.jobType, "print.dispatch");
assert.equal(first.status, "queued");

const replay = enqueueMockPrintJob({
  idempotencyKey: "print_same",
  documentId: "BL-1",
});
assert.equal(replay.id, first.id);

const reprint = enqueueMockPrintJob({
  idempotencyKey: "print_reprint",
  documentId: "BL-1",
  reprintOf: first.id,
});
assert.notEqual(reprint.id, first.id);
assert.equal(reprint.reprintOf, first.id);

const planC = enqueueMockPrintJob({
  idempotencyKey: "print_planc",
  documentId: "BL-1",
  planC: true,
});
assert.equal(planC.status, "plan_c");
assert.equal(getMockPrintJob(planC.id)?.status, "plan_c");

assert.equal(getMockPrintJob("prn_missing"), null);

console.log("print-job mock enqueue OK");
