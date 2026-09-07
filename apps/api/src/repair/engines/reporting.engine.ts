import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, RepReportStatus } from '@prisma/client';
import { OutboxService } from '../../audit/outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  REPAIR_AGGREGATE_TYPES,
  REPAIR_EVENT_TYPES,
} from '../repair.constants';

const SECRET_KEY_RE =
  /(password|secret|token|authorization|api[_-]?key|cookie|credential)/i;

@Injectable()
export class ReportingEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  sanitizePayload(payload: unknown): Prisma.InputJsonValue {
    return this.sanitize(payload) as Prisma.InputJsonValue;
  }

  async queueReport(input: {
    companyId?: string;
    reportType: string;
    payload: unknown;
  }) {
    const sanitized = this.sanitizePayload(input.payload);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(sanitized))
      .digest('hex')
      .slice(0, 40);

    const report = await this.prisma.repCentralReport.create({
      data: {
        companyId: input.companyId,
        reportType: input.reportType,
        fingerprint,
        payloadJson: sanitized,
        status: RepReportStatus.PENDING,
      },
    });

    const outboxRow = await this.prisma.repDiagnosticOutbox.create({
      data: {
        reportId: report.id,
        state: RepReportStatus.QUEUED,
      },
    });

    await this.prisma.repCentralReport.update({
      where: { id: report.id },
      data: { status: RepReportStatus.QUEUED },
    });

    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: REPAIR_AGGREGATE_TYPES.REPORT,
        aggregateId: report.id,
        eventType: REPAIR_EVENT_TYPES.REPORT_QUEUED,
        payloadJson: {
          reportId: report.id,
          reportType: input.reportType,
          fingerprint,
          // External HTTP delivery deferred — local outbox only.
          delivery: 'deferred-local',
        },
      });
    });

    return { report, outbox: outboxRow };
  }

  async status() {
    const [pending, queued, sent, failed] = await Promise.all([
      this.prisma.repCentralReport.count({
        where: { status: RepReportStatus.PENDING },
      }),
      this.prisma.repCentralReport.count({
        where: { status: RepReportStatus.QUEUED },
      }),
      this.prisma.repCentralReport.count({
        where: { status: RepReportStatus.SENT },
      }),
      this.prisma.repCentralReport.count({
        where: { status: RepReportStatus.FAILED },
      }),
    ]);

    return {
      pending,
      queued,
      sent,
      failed,
      externalHttp: 'deferred',
      note: 'Flush marks SENT locally — no external HTTP yet',
    };
  }

  /**
   * Marks queued reports SENT locally.
   * External HTTP delivery is deferred (no network call).
   */
  async flush(limit = 50) {
    const rows = await this.prisma.repDiagnosticOutbox.findMany({
      where: { state: RepReportStatus.QUEUED },
      take: limit,
      orderBy: { createdAt: 'asc' },
      include: { report: true },
    });

    const flushed: string[] = [];
    for (const row of rows) {
      await this.prisma.$transaction(async (tx) => {
        await tx.repDiagnosticOutbox.update({
          where: { id: row.id },
          data: {
            state: RepReportStatus.SENT,
            attempts: { increment: 1 },
          },
        });
        await tx.repCentralReport.update({
          where: { id: row.reportId },
          data: {
            status: RepReportStatus.SENT,
            attempts: { increment: 1 },
          },
        });
      });
      flushed.push(row.reportId);
    }

    return {
      flushed: flushed.length,
      flushedCount: flushed.length,
      reportIds: flushed,
      delivery: 'local-sent-only',
      note: 'External HTTP deferred',
    };
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((v) => this.sanitize(v));
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (SECRET_KEY_RE.test(k)) {
          out[k] = '[REDACTED]';
        } else {
          out[k] = this.sanitize(v);
        }
      }
      return out;
    }
    return value;
  }
}
