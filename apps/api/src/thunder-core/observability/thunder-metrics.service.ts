import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  type MetricValue,
} from 'prom-client';

export type ThunderMetricsGaugeInput = {
  dlqSize: number;
  outboxUnpublished: number;
  outboxLagOldestSeconds: number | null;
  breakers: Array<{
    dependencyKey: string;
    stateGauge: 0 | 1 | 2;
  }>;
  queues: Array<{
    family: string;
    pending: number;
    running: number;
  }>;
  workers: Array<{
    family: string;
    concurrency: number;
  }>;
  admissionRejectByReason: Record<string, number>;
};

@Injectable()
export class ThunderMetricsService {
  readonly registry = new Registry();

  private readonly jobDuration: Histogram<string>;
  private readonly jobSuccess: Counter<string>;
  private readonly jobFail: Counter<string>;
  private readonly jobRetry: Counter<string>;
  private readonly admissionReject: Counter<string>;
  private readonly dlqSize: Gauge<string>;
  private readonly outboxUnpublished: Gauge<string>;
  private readonly outboxLagOldest: Gauge<string>;
  private readonly breakerState: Gauge<string>;
  private readonly queuePending: Gauge<string>;
  private readonly queueRunning: Gauge<string>;
  private readonly workerConcurrency: Gauge<string>;

  constructor() {
    this.registry.setDefaultLabels({
      service: 'authority-api',
      component: 'thunder',
    });

    this.jobDuration = new Histogram({
      name: 'thunder_job_duration_seconds',
      help: 'Thunder job attempt duration in seconds',
      labelNames: ['job_type', 'queue', 'status'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
      registers: [this.registry],
    });

    this.jobSuccess = new Counter({
      name: 'thunder_job_success_total',
      help: 'Thunder jobs completed successfully',
      labelNames: ['job_type', 'queue'],
      registers: [this.registry],
    });

    this.jobFail = new Counter({
      name: 'thunder_job_fail_total',
      help: 'Thunder jobs failed terminally',
      labelNames: ['job_type', 'queue'],
      registers: [this.registry],
    });

    this.jobRetry = new Counter({
      name: 'thunder_job_retry_total',
      help: 'Thunder job retryable failures',
      labelNames: ['job_type', 'queue'],
      registers: [this.registry],
    });

    this.admissionReject = new Counter({
      name: 'thunder_admission_reject_total',
      help: 'Thunder admission rejects and Plan C denials',
      labelNames: ['reason'],
      registers: [this.registry],
    });

    this.dlqSize = new Gauge({
      name: 'thunder_dlq_size',
      help: 'Thunder DLQ entry count',
      registers: [this.registry],
    });

    this.outboxUnpublished = new Gauge({
      name: 'thunder_outbox_unpublished',
      help: 'Unpublished core_outbox rows',
      registers: [this.registry],
    });

    this.outboxLagOldest = new Gauge({
      name: 'thunder_outbox_lag_seconds',
      help: 'Age in seconds of the oldest unpublished outbox row',
      registers: [this.registry],
    });

    this.breakerState = new Gauge({
      name: 'thunder_breaker_state',
      help: 'Circuit breaker state (0=closed, 1=open, 2=half_open)',
      labelNames: ['dependency_key'],
      registers: [this.registry],
    });

    this.queuePending = new Gauge({
      name: 'thunder_queue_pending',
      help: 'Pending thunder_job rows by queue family',
      labelNames: ['family'],
      registers: [this.registry],
    });

    this.queueRunning = new Gauge({
      name: 'thunder_queue_running',
      help: 'Running thunder_job rows by queue family',
      labelNames: ['family'],
      registers: [this.registry],
    });

    this.workerConcurrency = new Gauge({
      name: 'thunder_worker_concurrency',
      help: 'Configured worker concurrency by queue family',
      labelNames: ['family'],
      registers: [this.registry],
    });
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  async metricsText(): Promise<string> {
    return this.registry.metrics();
  }

  observeJobDuration(input: {
    jobType: string;
    queue: string;
    status: 'success' | 'fail' | 'retry';
    seconds: number;
  }): void {
    this.jobDuration.observe(
      {
        job_type: input.jobType,
        queue: input.queue,
        status: input.status,
      },
      input.seconds,
    );
  }

  recordJobSuccess(jobType: string, queue: string): void {
    this.jobSuccess.inc({ job_type: jobType, queue });
  }

  recordJobFail(jobType: string, queue: string): void {
    this.jobFail.inc({ job_type: jobType, queue });
  }

  recordJobRetry(jobType: string, queue: string): void {
    this.jobRetry.inc({ job_type: jobType, queue });
  }

  recordAdmissionReject(reason: string): void {
    this.admissionReject.inc({ reason });
  }

  syncGauges(input: ThunderMetricsGaugeInput): void {
    this.dlqSize.set(input.dlqSize);
    this.outboxUnpublished.set(input.outboxUnpublished);
    this.outboxLagOldest.set(input.outboxLagOldestSeconds ?? 0);

    for (const breaker of input.breakers) {
      this.breakerState.set(
        { dependency_key: breaker.dependencyKey },
        breaker.stateGauge,
      );
    }

    for (const queue of input.queues) {
      this.queuePending.set({ family: queue.family }, queue.pending);
      this.queueRunning.set({ family: queue.family }, queue.running);
    }

    for (const worker of input.workers) {
      this.workerConcurrency.set({ family: worker.family }, worker.concurrency);
    }

    // Counters are cumulative; gauges for admission are not mirrored here.
    void input.admissionRejectByReason;
  }

  async summaryCounters(): Promise<{
    jobSuccessTotal: number;
    jobFailTotal: number;
    jobRetryTotal: number;
    admissionRejectTotal: number;
  }> {
    const [success, fail, retry, admission] = await Promise.all([
      this.jobSuccess.get(),
      this.jobFail.get(),
      this.jobRetry.get(),
      this.admissionReject.get(),
    ]);
    return {
      jobSuccessTotal: sumMetricValues(success.values),
      jobFailTotal: sumMetricValues(fail.values),
      jobRetryTotal: sumMetricValues(retry.values),
      admissionRejectTotal: sumMetricValues(admission.values),
    };
  }
}

function sumMetricValues(values: MetricValue<string>[]): number {
  return values.reduce((sum, row) => sum + (row.value ?? 0), 0);
}
