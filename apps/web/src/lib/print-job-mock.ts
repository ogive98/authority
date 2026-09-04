export type PrintJobStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "plan_c";

export type PrintJob = {
  id: string;
  documentId: string;
  jobType: "print.dispatch";
  queue: "print";
  status: PrintJobStatus;
  progress: number;
  message: string;
  idempotencyKey: string;
  reprintOf: string | null;
  createdAt: number;
};

export const PRINT_JOB_STATUS_LABEL: Record<PrintJobStatus, string> = {
  queued: "En file",
  running: "En cours",
  done: "Terminé",
  failed: "Échec",
  plan_c: "Plan C — imprimer plus tard",
};

type Store = {
  byId: Map<string, PrintJob>;
  byIdem: Map<string, string>;
};

function store(): Store {
  const g = globalThis as { __authorityPrintJobs?: Store };
  if (!g.__authorityPrintJobs) {
    g.__authorityPrintJobs = {
      byId: new Map(),
      byIdem: new Map(),
    };
  }
  return g.__authorityPrintJobs;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `prn_${crypto.randomUUID()}`;
  }
  return `prn_${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Advance mock lifecycle from createdAt. Plan C / failed stay put. */
export function tickPrintJob(job: PrintJob, now = Date.now()): PrintJob {
  if (job.status === "plan_c" || job.status === "failed" || job.status === "done") {
    return job;
  }
  const elapsed = now - job.createdAt;
  let next: PrintJob = job;
  if (elapsed < 400) {
    next = { ...job, status: "queued", progress: 0, message: "File print · P2" };
  } else if (elapsed < 1_200) {
    next = {
      ...job,
      status: "running",
      progress: 40,
      message: "Rendu PDF mock",
    };
  } else if (elapsed < 2_000) {
    next = {
      ...job,
      status: "running",
      progress: 75,
      message: "Dispatch agent (mock)",
    };
  } else {
    next = {
      ...job,
      status: "done",
      progress: 100,
      message: "Ack agent mock",
    };
  }
  store().byId.set(next.id, next);
  return next;
}

export function enqueueMockPrintJob(input: {
  idempotencyKey: string;
  documentId: string;
  reprintOf?: string | null;
  planC?: boolean;
}): PrintJob {
  const s = store();
  const existingId = s.byIdem.get(input.idempotencyKey);
  if (existingId) {
    const existing = s.byId.get(existingId);
    if (existing) return tickPrintJob(existing);
  }

  const job: PrintJob = input.planC
    ? {
        id: newId(),
        documentId: input.documentId,
        jobType: "print.dispatch",
        queue: "print",
        status: "plan_c",
        progress: 0,
        message: "Capacité limitée — imprimer plus tard (Plan C).",
        idempotencyKey: input.idempotencyKey,
        reprintOf: input.reprintOf ?? null,
        createdAt: Date.now(),
      }
    : {
        id: newId(),
        documentId: input.documentId,
        jobType: "print.dispatch",
        queue: "print",
        status: "queued",
        progress: 0,
        message: "File print · P2",
        idempotencyKey: input.idempotencyKey,
        reprintOf: input.reprintOf ?? null,
        createdAt: Date.now(),
      };

  s.byId.set(job.id, job);
  s.byIdem.set(input.idempotencyKey, job.id);
  return job;
}

export function getMockPrintJob(id: string): PrintJob | null {
  const job = store().byId.get(id);
  if (!job) return null;
  return tickPrintJob(job);
}

export function resetMockPrintJobs(): void {
  const s = store();
  s.byId.clear();
  s.byIdem.clear();
}
