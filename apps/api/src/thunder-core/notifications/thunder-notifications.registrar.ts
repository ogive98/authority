import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NotificationsService } from '../../notifications/notifications.service';
import type { AuthorityEventEnvelope } from '../events/event-envelope';
import { ConsumerRegistryService } from '../events/consumer-registry.service';
import {
  THUNDER_NOTIFICATIONS_CONSUMER_ID,
  THUNDER_NOTIFICATIONS_EVENT_TYPES,
} from './thunder-notifications.constants';

/**
 * D290 — pull-materialize in-app inbox after métier events (idempotent sync).
 * Never invents rates · never FULL_AUTO · never creates FinPayment / WO.
 */
@Injectable()
export class ThunderNotificationsRegistrar implements OnModuleInit {
  private readonly logger = new Logger(ThunderNotificationsRegistrar.name);

  constructor(
    private readonly registry: ConsumerRegistryService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      THUNDER_NOTIFICATIONS_CONSUMER_ID,
      (envelope) => this.onEvent(envelope),
      {
        consumes: [
          THUNDER_NOTIFICATIONS_EVENT_TYPES.portalPaymentDeclarationSubmitted,
          THUNDER_NOTIFICATIONS_EVENT_TYPES.financeOpenItemCreated,
          THUNDER_NOTIFICATIONS_EVENT_TYPES.financePromiseStatus,
          THUNDER_NOTIFICATIONS_EVENT_TYPES.salesWaInboxDraftCreated,
          THUNDER_NOTIFICATIONS_EVENT_TYPES.salesOrderConfirmed,
          THUNDER_NOTIFICATIONS_EVENT_TYPES.taxTejPackPrepared,
          THUNDER_NOTIFICATIONS_EVENT_TYPES.taxWithholdingCreated,
          THUNDER_NOTIFICATIONS_EVENT_TYPES.automationRunCreated,
        ],
      },
    );
  }

  async onEvent(envelope: AuthorityEventEnvelope): Promise<void> {
    const companyId = envelope.companyId;
    if (!companyId) return;
    try {
      const result = await this.notifications.sync(companyId);
      if (result.upserted > 0 || result.reconciled > 0) {
        this.logger.log(
          `notifications.materialize ${envelope.eventType}: upserted=${result.upserted} reconciled=${result.reconciled}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `notifications.materialize failed for ${envelope.eventType}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
