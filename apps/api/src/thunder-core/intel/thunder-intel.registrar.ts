import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  FinOpenItemSide,
  FinOpenItemStatus,
  FinPromiseStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthorityEventEnvelope } from '../events/event-envelope';
import { ConsumerRegistryService } from '../events/consumer-registry.service';
import {
  THUNDER_INTEL_CONSUMER_ID,
  THUNDER_INTEL_EVENT_TYPES,
  THUNDER_SIGNAL_TYPES,
} from './intel.constants';
import { RecommendationService } from './recommendation.service';
import { SignalService } from './signal.service';

@Injectable()
export class ThunderIntelRegistrar implements OnModuleInit {
  private readonly logger = new Logger(ThunderIntelRegistrar.name);

  constructor(
    private readonly registry: ConsumerRegistryService,
    private readonly signals: SignalService,
    private readonly recommendations: RecommendationService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      THUNDER_INTEL_CONSUMER_ID,
      (envelope) => this.handle(envelope),
      {
        consumes: [
          THUNDER_INTEL_EVENT_TYPES.deliveryFailed,
          THUNDER_INTEL_EVENT_TYPES.salesConfirmed,
          THUNDER_INTEL_EVENT_TYPES.financeAllocation,
          THUNDER_INTEL_EVENT_TYPES.financeOpenItemCreated,
          THUNDER_INTEL_EVENT_TYPES.financePromiseCreated,
          THUNDER_INTEL_EVENT_TYPES.financePromiseStatus,
        ],
      },
    );
  }

  async handle(envelope: AuthorityEventEnvelope): Promise<void> {
    if (!envelope.companyId) {
      return;
    }

    switch (envelope.eventType) {
      case THUNDER_INTEL_EVENT_TYPES.deliveryFailed:
        await this.onDeliveryFailed(envelope);
        return;
      case THUNDER_INTEL_EVENT_TYPES.salesConfirmed:
        await this.onSalesConfirmed(envelope);
        return;
      case THUNDER_INTEL_EVENT_TYPES.financeAllocation:
        await this.onFinanceAllocation(envelope);
        await this.maybeEmitOverdue(envelope);
        return;
      case THUNDER_INTEL_EVENT_TYPES.financeOpenItemCreated:
        await this.maybeEmitOverdue(envelope);
        return;
      case THUNDER_INTEL_EVENT_TYPES.financePromiseCreated:
      case THUNDER_INTEL_EVENT_TYPES.financePromiseStatus:
        await this.maybeEmitBrokenPromises(envelope);
        return;
      default:
        return;
    }
  }

  private async onDeliveryFailed(
    envelope: AuthorityEventEnvelope,
  ): Promise<void> {
    const signal = await this.signals.create({
      companyId: envelope.companyId!,
      siteId: envelope.siteId,
      type: THUNDER_SIGNAL_TYPES.DeliveryFailed,
      severity: 'WARN',
      source: THUNDER_INTEL_CONSUMER_ID,
      sourceEventId: envelope.eventId,
      sourceEventType: envelope.eventType,
      correlationId: envelope.correlationId,
      evidence: {
        aggregateType: envelope.aggregateType,
        aggregateId: envelope.aggregateId,
        payload: envelope.payload,
      },
      occurredAt: new Date(envelope.occurredAt),
    });

    await this.recommendations.create({
      companyId: envelope.companyId!,
      signalId: signal.id,
      problem: 'Shipment delivery failed — review fail reason and retry path',
      evidence: {
        signalId: signal.id,
        shipmentId: envelope.aggregateId,
        payload: envelope.payload,
      },
      options: [
        { id: 'review', label: 'Review shipment in Delivery' },
        { id: 'ack', label: 'Acknowledge without action' },
      ],
      autonomyLevel: 2,
      proposedAction: {
        type: 'record_only',
        capabilityHint: 'delivery.read',
        aggregateId: envelope.aggregateId,
      },
      correlationId: envelope.correlationId,
    });

    this.logger.log(
      `signal DeliveryFailed event=${envelope.eventId} company=${envelope.companyId}`,
    );
  }

  private async onSalesConfirmed(
    envelope: AuthorityEventEnvelope,
  ): Promise<void> {
    await this.signals.create({
      companyId: envelope.companyId!,
      siteId: envelope.siteId,
      type: THUNDER_SIGNAL_TYPES.SalesOrderConfirmed,
      severity: 'INFO',
      source: THUNDER_INTEL_CONSUMER_ID,
      sourceEventId: envelope.eventId,
      sourceEventType: envelope.eventType,
      correlationId: envelope.correlationId,
      evidence: {
        aggregateType: envelope.aggregateType,
        aggregateId: envelope.aggregateId,
        payload: envelope.payload,
      },
      occurredAt: new Date(envelope.occurredAt),
    });
  }

  private async onFinanceAllocation(
    envelope: AuthorityEventEnvelope,
  ): Promise<void> {
    await this.signals.create({
      companyId: envelope.companyId!,
      siteId: envelope.siteId,
      type: THUNDER_SIGNAL_TYPES.FinanceAllocationRecorded,
      severity: 'INFO',
      source: THUNDER_INTEL_CONSUMER_ID,
      sourceEventId: envelope.eventId,
      sourceEventType: envelope.eventType,
      correlationId: envelope.correlationId,
      evidence: {
        aggregateType: envelope.aggregateType,
        aggregateId: envelope.aggregateId,
        payload: envelope.payload,
      },
      occurredAt: new Date(envelope.occurredAt),
    });
  }

  /** Collections V0: if customer still has overdue AR, emit WARN + reco. */
  private async maybeEmitOverdue(
    envelope: AuthorityEventEnvelope,
  ): Promise<void> {
    const companyId = envelope.companyId!;
    const customerId =
      typeof envelope.payload.customerId === 'string'
        ? envelope.payload.customerId
        : null;
    if (!customerId) return;

    const today = new Date();
    const start = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const overdueCount = await this.prisma.finOpenItem.count({
      where: {
        companyId,
        customerId,
        deletedAt: null,
        side: FinOpenItemSide.AR,
        status: { in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL] },
        dueDate: { lt: start },
      },
    });
    if (overdueCount <= 0) return;

    const signal = await this.signals.create({
      companyId,
      siteId: envelope.siteId,
      type: THUNDER_SIGNAL_TYPES.FinanceOverdueOpenItems,
      severity: 'WARN',
      source: THUNDER_INTEL_CONSUMER_ID,
      sourceEventId: envelope.eventId,
      sourceEventType: envelope.eventType,
      correlationId: envelope.correlationId,
      evidence: {
        customerId,
        overdueCount,
        aggregateType: envelope.aggregateType,
        aggregateId: envelope.aggregateId,
      },
      occurredAt: new Date(envelope.occurredAt),
    });

    await this.recommendations.create({
      companyId,
      signalId: signal.id,
      problem: `Customer has ${overdueCount} overdue AR open item(s) — review collections`,
      evidence: {
        signalId: signal.id,
        customerId,
        overdueCount,
      },
      options: [
        { id: 'review_finance', label: 'Open Créances (Échues)' },
        { id: 'ack', label: 'Acknowledge without action' },
      ],
      autonomyLevel: 2,
      proposedAction: {
        type: 'record_only',
        capabilityHint: 'finance.ar.read',
        aggregateId: customerId,
      },
      correlationId: envelope.correlationId,
    });

    this.logger.log(
      `signal FinanceOverdueOpenItems customer=${customerId} count=${overdueCount}`,
    );
  }

  /** Collections PTP: broken promises → WARN + reco (no sales block). */
  private async maybeEmitBrokenPromises(
    envelope: AuthorityEventEnvelope,
  ): Promise<void> {
    const companyId = envelope.companyId!;
    const customerId =
      typeof envelope.payload.customerId === 'string'
        ? envelope.payload.customerId
        : null;
    if (!customerId) return;

    const status =
      typeof envelope.payload.status === 'string'
        ? envelope.payload.status
        : null;
    if (
      envelope.eventType === THUNDER_INTEL_EVENT_TYPES.financePromiseStatus &&
      status !== FinPromiseStatus.BROKEN
    ) {
      return;
    }

    const brokenCount = await this.prisma.finPromiseToPay.count({
      where: {
        companyId,
        customerId,
        deletedAt: null,
        status: FinPromiseStatus.BROKEN,
      },
    });
    if (brokenCount <= 0) return;

    const signal = await this.signals.create({
      companyId,
      siteId: envelope.siteId,
      type: THUNDER_SIGNAL_TYPES.FinanceBrokenPromises,
      severity: 'WARN',
      source: THUNDER_INTEL_CONSUMER_ID,
      sourceEventId: envelope.eventId,
      sourceEventType: envelope.eventType,
      correlationId: envelope.correlationId,
      evidence: {
        customerId,
        brokenCount,
        aggregateType: envelope.aggregateType,
        aggregateId: envelope.aggregateId,
      },
      occurredAt: new Date(envelope.occurredAt),
    });

    await this.recommendations.create({
      companyId,
      signalId: signal.id,
      problem: `Customer has ${brokenCount} broken promise-to-pay(s) — review collections`,
      evidence: {
        signalId: signal.id,
        customerId,
        brokenCount,
      },
      options: [
        { id: 'review_promises', label: 'Open Promesses (Rompues)' },
        { id: 'ack', label: 'Acknowledge without action' },
      ],
      autonomyLevel: 2,
      proposedAction: {
        type: 'record_only',
        capabilityHint: 'finance.ar.read',
        aggregateId: customerId,
      },
      correlationId: envelope.correlationId,
    });

    this.logger.log(
      `signal FinanceBrokenPromises customer=${customerId} count=${brokenCount}`,
    );
  }
}
