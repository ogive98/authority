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
import { CollectionScheduleResolver } from '../../finance/collection-schedule.resolver';
import {
  matchedMilestones,
} from '../../finance/collection-schedule.resolver';

@Injectable()
export class ThunderIntelRegistrar implements OnModuleInit {
  private readonly logger = new Logger(ThunderIntelRegistrar.name);

  constructor(
    private readonly registry: ConsumerRegistryService,
    private readonly signals: SignalService,
    private readonly recommendations: RecommendationService,
    private readonly prisma: PrismaService,
    private readonly collectionSchedule: CollectionScheduleResolver,
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

  /** Collections: overdue AR + company remind_days milestones (D182). */
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
    const overdueItems = await this.prisma.finOpenItem.findMany({
      where: {
        companyId,
        customerId,
        deletedAt: null,
        side: FinOpenItemSide.AR,
        status: { in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL] },
        dueDate: { lt: start },
      },
      select: { dueDate: true, amountOpen: true },
    });
    const overdueCount = overdueItems.length;
    if (overdueCount <= 0) return;

    let maxDaysPastDue = 0;
    for (const row of overdueItems) {
      if (!row.dueDate) continue;
      const due = new Date(
        Date.UTC(
          row.dueDate.getUTCFullYear(),
          row.dueDate.getUTCMonth(),
          row.dueDate.getUTCDate(),
        ),
      );
      const days = Math.floor(
        (start.getTime() - due.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (days > maxDaysPastDue) maxDaysPastDue = days;
    }

    const remindDays =
      await this.collectionSchedule.resolveRemindDays(companyId);
    const milestones = matchedMilestones(remindDays, maxDaysPastDue);
    // Empty schedule → binary overdue (any past due). Non-empty → only if milestone hit.
    if (remindDays.length > 0 && milestones.length === 0) return;

    const signalType =
      milestones.length > 0
        ? THUNDER_SIGNAL_TYPES.FinanceCollectionMilestone
        : THUNDER_SIGNAL_TYPES.FinanceOverdueOpenItems;
    const highest = milestones.length
      ? milestones[milestones.length - 1]!
      : null;

    const signal = await this.signals.create({
      companyId,
      siteId: envelope.siteId,
      type: signalType,
      severity: 'WARN',
      source: THUNDER_INTEL_CONSUMER_ID,
      sourceEventId: envelope.eventId,
      sourceEventType: envelope.eventType,
      correlationId: envelope.correlationId,
      evidence: {
        customerId,
        overdueCount,
        maxDaysPastDue,
        remindDays,
        milestonesMatched: milestones,
        highestMilestone: highest,
        aggregateType: envelope.aggregateType,
        aggregateId: envelope.aggregateId,
      },
      occurredAt: new Date(envelope.occurredAt),
    });

    const problem =
      highest != null
        ? `Customer AR overdue J+${highest} (max ${maxDaysPastDue}d, ${overdueCount} item(s)) — review collections`
        : `Customer has ${overdueCount} overdue AR open item(s) — review collections`;

    await this.recommendations.create({
      companyId,
      signalId: signal.id,
      problem,
      evidence: {
        signalId: signal.id,
        customerId,
        overdueCount,
        maxDaysPastDue,
        milestonesMatched: milestones,
        highestMilestone: highest,
      },
      options: [
        { id: 'review_finance', label: 'Open Créances (Échues)' },
        { id: 'review_customer', label: 'Open customer hub' },
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
      `signal ${signalType} customer=${customerId} count=${overdueCount} maxDays=${maxDaysPastDue} milestones=${milestones.join(',')}`,
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
