import { NextResponse } from "next/server";
import { getMockPrintJob } from "@/lib/print-job-mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const job = getMockPrintJob(id);
  if (!job) {
    return NextResponse.json(
      { code: "PRI.NOT_FOUND", message: "Print job not found." },
      { status: 404 },
    );
  }
  return NextResponse.json(job);
}
