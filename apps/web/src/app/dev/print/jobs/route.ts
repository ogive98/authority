import { NextResponse } from "next/server";
import { enqueueMockPrintJob } from "@/lib/print-job-mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mock print enqueue (UI-12). Path under /dev so Next does not proxy to Nest.
 * Real path later: POST /api/v1/print/print-jobs → Thunder file print.
 */
export async function POST(request: Request) {
  const idempotencyKey =
    request.headers.get("Idempotency-Key")?.trim() ||
    request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) {
    return NextResponse.json(
      { code: "PRI.IDEMPOTENCY", message: "Idempotency-Key required." },
      { status: 400 },
    );
  }

  let body: {
    documentId?: string;
    reprintOf?: string | null;
    planC?: boolean;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const documentId =
    typeof body.documentId === "string" && body.documentId.trim()
      ? body.documentId.trim()
      : "DOC-MOCK";

  const job = enqueueMockPrintJob({
    idempotencyKey,
    documentId,
    reprintOf: body.reprintOf,
    planC: body.planC === true,
  });

  return NextResponse.json(job, { status: 202 });
}
