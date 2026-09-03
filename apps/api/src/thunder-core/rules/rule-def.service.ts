import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ThunderException } from '../thunder.exception';
import { assertActionsWhitelisted, detectRuleCycles } from './rule-cycle';
import {
  THUNDER_RULE_ERROR_CODES,
  type RuleAction,
  type ThunderRuleDefinition,
} from './rule.types';

@Injectable()
export class RuleDefService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params?: {
    companyId?: string;
  }): Promise<ThunderRuleDefinition[]> {
    const rows = await this.prisma.thunderRuleDef.findMany({
      where: params?.companyId
        ? {
            OR: [{ companyId: params.companyId }, { companyId: null }],
          }
        : undefined,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(mapRow);
  }

  async get(id: string): Promise<ThunderRuleDefinition> {
    const row = await this.prisma.thunderRuleDef.findUnique({ where: { id } });
    if (!row) {
      throw new ThunderException(
        THUNDER_RULE_ERROR_CODES.NOT_FOUND,
        `Rule not found: ${id}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return mapRow(row);
  }

  async create(input: ThunderRuleDefinition): Promise<ThunderRuleDefinition> {
    this.validate(input);
    await this.assertNoCycleWith(input);

    const row = await this.prisma.thunderRuleDef.create({
      data: {
        companyId: input.companyId ?? null,
        moduleKey: input.moduleKey,
        name: input.name,
        enabled: input.enabled,
        priority: input.priority,
        eventPattern: input.eventPattern,
        conditionsJson: input.conditions as Prisma.InputJsonValue,
        actionsJson: input.actions,
      },
    });
    return mapRow(row);
  }

  async update(
    id: string,
    patch: Partial<ThunderRuleDefinition>,
  ): Promise<ThunderRuleDefinition> {
    const existing = await this.get(id);
    const merged: ThunderRuleDefinition = {
      ...existing,
      ...patch,
      id,
      conditions: patch.conditions ?? existing.conditions,
      actions: patch.actions ?? existing.actions,
    };
    this.validate(merged);
    await this.assertNoCycleWith(merged, id);

    const row = await this.prisma.thunderRuleDef.update({
      where: { id },
      data: {
        companyId: merged.companyId ?? null,
        moduleKey: merged.moduleKey,
        name: merged.name,
        enabled: merged.enabled,
        priority: merged.priority,
        eventPattern: merged.eventPattern,
        conditionsJson: merged.conditions as Prisma.InputJsonValue,
        actionsJson: merged.actions,
      },
    });
    return mapRow(row);
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.thunderRuleDef.delete({ where: { id } });
  }

  private validate(input: ThunderRuleDefinition): void {
    if (!input.moduleKey || !input.name || !input.eventPattern) {
      throw new ThunderException(
        THUNDER_RULE_ERROR_CODES.INVALID_LOGIC,
        'moduleKey, name and eventPattern are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!Array.isArray(input.actions) || input.actions.length === 0) {
      throw new ThunderException(
        THUNDER_RULE_ERROR_CODES.INVALID_ACTION,
        'At least one action is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      assertActionsWhitelisted(input.actions);
    } catch (error) {
      throw new ThunderException(
        THUNDER_RULE_ERROR_CODES.INVALID_ACTION,
        error instanceof Error ? error.message : 'Invalid action',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async assertNoCycleWith(
    candidate: ThunderRuleDefinition,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.list(
      candidate.companyId ? { companyId: candidate.companyId } : undefined,
    );
    const combined = existing
      .filter((rule) => rule.id !== excludeId)
      .concat(candidate);
    const cycle = detectRuleCycles(combined);
    if (cycle) {
      throw new ThunderException(
        THUNDER_RULE_ERROR_CODES.CYCLE_DETECTED,
        `Rule cycle detected: ${cycle.join(' -> ')}`,
        HttpStatus.CONFLICT,
      );
    }
  }
}

function mapRow(row: {
  id: string;
  companyId: string | null;
  moduleKey: string;
  name: string;
  enabled: boolean;
  priority: number;
  eventPattern: string;
  conditionsJson: Prisma.JsonValue;
  actionsJson: Prisma.JsonValue;
}): ThunderRuleDefinition {
  return {
    id: row.id,
    companyId: row.companyId,
    moduleKey: row.moduleKey,
    name: row.name,
    enabled: row.enabled,
    priority: row.priority,
    eventPattern: row.eventPattern,
    conditions: (row.conditionsJson ?? {}) as Record<string, unknown>,
    actions: row.actionsJson as unknown as RuleAction[],
  };
}
