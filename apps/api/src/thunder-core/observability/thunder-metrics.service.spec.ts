import { ThunderMetricsService } from './thunder-metrics.service';

describe('ThunderMetricsService', () => {
  it('exposes prometheus text with thunder metrics', async () => {
    const metrics = new ThunderMetricsService();
    metrics.recordJobSuccess('thunder.hello.v1', 'ops');
    metrics.recordAdmissionReject('THUNDER.SHED_P4');
    metrics.observeJobDuration({
      jobType: 'thunder.hello.v1',
      queue: 'ops',
      status: 'success',
      seconds: 0.12,
    });
    metrics.syncGauges({
      dlqSize: 3,
      outboxUnpublished: 4,
      outboxDlqSize: 1,
      outboxLagOldestSeconds: 12.5,
      breakers: [{ dependencyKey: 'external_api_stub', stateGauge: 0 }],
      queues: [{ family: 'ops', pending: 2, running: 1 }],
      workers: [{ family: 'ops', concurrency: 2 }],
      admissionRejectByReason: {},
    });

    const text = await metrics.metricsText();
    expect(text).toContain('thunder_job_success_total');
    expect(text).toContain('thunder_admission_reject_total');
    expect(text).toContain('thunder_dlq_size');
    expect(text).toContain('thunder_outbox_dlq_size');
    expect(text).toContain('thunder_breaker_state');
    expect(metrics.contentType).toContain('text/plain');

    const summary = await metrics.summaryCounters();
    expect(summary.jobSuccessTotal).toBe(1);
    expect(summary.admissionRejectTotal).toBe(1);
  });
});
