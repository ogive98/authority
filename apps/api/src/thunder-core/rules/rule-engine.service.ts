import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ModuleRegistryService } from '../../modules-registry/module-registry.service';
import type { AuthorityEventEnvelope } from '../events/event-envelope';
import { JobEnqueueService } from '../jobs/job-enqueue.service';
import { evaluateJsonLogicWithTimeout } from './json-logic.sandbox';
import { matchesEventPattern } from './rule-cycle';
import { RuleDefService } from './rule-def.service';
import {
  RULE_EVAL_TIMEOUT_MS,
  type RuleAction,
  type ThunderRuleDefinition,
} from './rule.types';

/** In-memory notify ledger for Phase 1 / tests (no email provider). */
export const ruleNotifyLedger: Array<{
  templateId: string;
  channel: string;
  companyId?: string;
  correlationId: string;
  eventId: string;
  ruleId?: string;
}> = [];

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor(
    private readonly rules: RuleDefService,
    private readonly modules: ModuleRegistryService,
    private readonly enqueue: JobEnqueueService,
  ) {}

  async handleEvent(envelope: AuthorityEventEnvelope): Promise<void> {
    const defs = await this.rules.list(
      envelope.companyId ? { companyId: envelope.companyId } : undefined,
    );

    const matched = defs
      .filter((rule) => rule.enabled)
      .filter((rule) =>
        matchesEventPattern(rule.eventPattern, envelope.eventType),
      )
      .sort((a, b) => a.priority - b.priority);

    for (const rule of matched) {
      try {
        await this.applyRule(rule, envelope);
      } catch (error) {
        this.logger.warn(
          error instanceof Error
            ? `Rule ${rule.id} failed: ${error.message}`
            : `Rule ${rule.id} failed`,
        );
      }
    }
  }

  private async applyRule(
    rule: ThunderRuleDefinition,
    envelope: AuthorityEventEnvelope,
  ): Promise<void> {
    if (envelope.companyId) {
      const enabled = await this.modules.isEnabled(
        envelope.companyId,
        rule.moduleKey,
      );
      if (!enabled) {
        return;
      }
    }

    const data = {
      eventType: envelope.eventType,
      companyId: envelope.companyId,
      aggregateId: envelope.aggregateId,
      aggregateType: envelope.aggregateType,
      payload: envelope.payload,
      correlationId: envelope.correlationId,
    };

    let passed: unknown;
    try {
      passed = await evaluateJsonLogicWithTimeout(
        rule.conditions,
        data,
        RULE_EVAL_TIMEOUT_MS,
      );
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? `Rule ${rule.id} condition error: ${error.message}`
          : `Rule ${rule.id} condition error`,
      );
      return;
    }

    if (!passed) {
      return;
    }

    for (const action of rule.actions) {
      await this.executeAction(action, rule, envelope);
    }
  }

  private async executeAction(
    action: RuleAction,
    rule: ThunderRuleDefinition,
    envelope: AuthorityEventEnvelope,
  ): Promise<void> {
    if (action.type === 'notify') {
      ruleNotifyLedger.push({
        templateId: action.templateId,
        channel: action.channel,
        companyId: envelope.companyId,
        correlationId: envelope.correlationId,
        eventId: envelope.eventId,
        ruleId: rule.id,
      });
      return;
    }

    if (action.type === 'enqueue_job') {
      if (!envelope.companyId) {
        throw new Error('enqueue_job requires companyId on event');
      }
      await this.enqueue.enqueue({
        jobType: action.jobType,
        companyId: envelope.companyId,
        queue: action.queue,
        idempotencyKey: `rule.${rule.id}.${envelope.eventId}.${action.jobType}`,
        payload: {
          source: 'thunder.rules',
          ruleId: rule.id,
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          aggregateId: envelope.aggregateId,
          payload: envelope.payload,
        },
        correlationId: envelope.correlationId ?? randomUUID(),
      });
    }
  }
}
