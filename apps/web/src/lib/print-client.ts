import type { PrintJob } from "@/lib/print-job-mock";

export async function postPrintJob(input: {
  documentId: string;
  idempotencyKey: string;
  reprintOf?: string | null;
  planC?: boolean;
}): Promise<PrintJob> {
  const res = await fetch("/dev/print/jobs", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      documentId: input.documentId,
      reprintOf: input.reprintOf ?? null,
      planC: Boolean(input.planC),
    }),
  });
  if (!res.ok) {
    throw new Error(`Print enqueue failed (${res.status})`);
  }
  return (await res.json()) as PrintJob;
}

export async function fetchPrintJob(id: string): Promise<PrintJob | null> {
  const res = await fetch(`/dev/print/jobs/${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Print job fetch failed (${res.status})`);
  }
  return (await res.json()) as PrintJob;
}
