import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AutomationService } from '../../automation/automation.service';
import { ModuleRegistryService } from '../../modules-registry/module-registry.service';
import type { AuthorityEventEnvelope } from '../events/event-envelope';
import { ConsumerRegistryService } from '../events/consumer-registry.service';
import {
  THUNDER_AUTOMATION_CONSUMER_ID,
  THUNDER_AUTOMATION_EVENT_TYPES,
} from './thunder-automation.constants';

/**
 * D289 — Thunder HOW only: map outbox events → Automation ASSISTED suggests.
 * Never mutates finance/sales/tax; profiles stay human-gated (FULL_AUTO forbidden).
 */
@Injectable()
export class ThunderAutomationRegistrar implements OnModuleInit {
  private readonly logger = new Logger(ThunderAutomationRegistrar.name);

  constructor(
    private readonly registry: ConsumerRegistryService,
    private readonly modules: ModuleRegistryService,
    private readonly automation: AutomationService,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      THUNDER_AUTOMATION_CONSUMER_ID,
      (envelope) => this.onEvent(envelope),
      {
        consumes: [
          THUNDER_AUTOMATION_EVENT_TYPES.portalPaymentDeclarationSubmitted,
          THUNDER_AUTOMATION_EVENT_TYPES.financeOpenItemCreated,
          THUNDER_AUTOMATION_EVENT_TYPES.salesWaInboxDraftCreated,
          THUNDER_AUTOMATION_EVENT_TYPES.taxTejPackPrepared,
        ],
      },
    );
  }

  async onEvent(envelope: AuthorityEventEnvelope): Promise<void> {
    const companyId = envelope.companyId;
    if (!companyId) return;
    if (!(await this.modules.isEnabled(companyId, 'automation'))) {
      return;
    }

    try {
      const result = await this.automation.suggestFromEvent(companyId, {
        eventType: envelope.eventType,
        eventId: envelope.eventId,
        aggregateId: envelope.aggregateId,
        payload: asRecord(envelope.payload),
      });
      if (result.created > 0) {
        this.logger.log(
          `automation.suggestFromEvent ${envelope.eventType}: created=${result.created} skipped=${result.skipped}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `automation.suggestFromEvent failed for ${envelope.eventType}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}
