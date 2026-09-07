import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
}
