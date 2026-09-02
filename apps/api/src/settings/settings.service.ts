import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, SetDef, SetLevel, SetValue } from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  OUTBOX_EVENT_TYPES,
} from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../audit/outbox.service';
import { isCataloguedPermission } from '../permissions/permission.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildScopeKey,
  KERNEL_SETTING_KEYS,
  SETTINGS_ERROR_CODES,
  SETTING_ENUM_VALUES,
  SETTING_LEVEL_PRIORITY,
  type KernelSettingKey,
} from './settings.constants';
import { SettingsException } from './settings.exception';

export interface EffectiveSetting {
  key: string;
  value: unknown;
  source: SetLevel;
  valueType: string;
  description: string | null;
}

export interface EffectiveSettingsResponse {
  companyId: string;
  settings: EffectiveSetting[];
}

interface ResolveContext {
  userId: string;
  companyId: string;
  roleCode?: string;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {}

  async getEffective(
    context: ResolveContext,
  ): Promise<EffectiveSettingsResponse> {
    const definitions = await this.prisma.setDef.findMany({
      orderBy: { key: 'asc' },
    });

    const scopeKeys = this.buildScopeKeys(context);
    const values = await this.prisma.setValue.findMany({
      where: {
        scopeKey: { in: scopeKeys },
        deletedAt: null,
      },
    });

    const settings = definitions.map((definition) =>
      this.resolveDefinition(definition, values, context),
    );

    return {
      companyId: context.companyId,
      settings,
    };
  }

  async upsertValue(params: {
    context: ResolveContext;
    key: string;
    value: unknown;
    level: 'USER' | 'COMPANY';
    actorUserId: string;
    correlationId?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<EffectiveSetting> {
    const definition = await this.loadWritableDefinition(params.key);
    this.validateValue(definition, params.value);

    const setLevel =
      params.level === 'COMPANY' ? SetLevel.COMPANY : SetLevel.USER;
    const subjectId =
      setLevel === SetLevel.COMPANY
        ? params.context.companyId
        : params.context.userId;
    const scopeKey = buildScopeKey(setLevel, {
      companyId: params.context.companyId,
      subjectId,
    });

    const existing = await this.prisma.setValue.findUnique({
      where: {
        defKey_scopeKey: {
          defKey: definition.key,
          scopeKey,
        },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.setValue.update({
            where: { id: existing.id },
            data: {
              valueJson: params.value as Prisma.InputJsonValue,
              deletedAt: null,
              version: { increment: 1 },
            },
          })
        : await tx.setValue.create({
            data: {
              defKey: definition.key,
              level: setLevel,
              scopeKey,
              companyId: params.context.companyId,
              valueJson: params.value as Prisma.InputJsonValue,
            },
          });

      await this.auditService.append(tx, {
        companyId: params.context.companyId,
        actorUserId: params.actorUserId,
        action: AUDIT_ACTIONS.settingsValueUpdate,
        entityType: AUDIT_ENTITY_TYPES.setValue,
        entityId: saved.id,
        beforeJson: existing ? { value: existing.valueJson } : undefined,
        afterJson: {
          key: definition.key,
          level: setLevel,
          scopeKey,
          value: params.value,
        } as Prisma.InputJsonValue,
        ip: params.ip,
        device: params.userAgent,
        correlationId: params.correlationId,
      });

      await this.outboxService.enqueue(tx, {
        companyId: params.context.companyId,
        aggregateType: AUDIT_ENTITY_TYPES.setValue,
        aggregateId: saved.id,
        eventType: OUTBOX_EVENT_TYPES.settingsValueUpdated,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.settingsValueUpdated,
          eventVersion: 1,
          source: 'settings',
          actorId: params.actorUserId,
          companyId: params.context.companyId,
          correlationId: params.correlationId ?? null,
          payload: {
            key: definition.key,
            level: setLevel,
            scopeKey,
            value: params.value,
          },
        } as Prisma.InputJsonValue,
      });
    });

    const effective = await this.getEffective(params.context);
    const updated = effective.settings.find(
      (row) => row.key === definition.key,
    );
    if (!updated) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.INVALID,
        `Setting ${definition.key} could not be resolved.`,
      );
    }

    return updated;
  }

  async resolveRoleCode(
    userId: string,
    companyId: string,
  ): Promise<string | undefined> {
    const assignment = await this.prisma.orgUserAssignment.findFirst({
      where: { userId, companyId, deletedAt: null },
    });
    return assignment?.roleCode ?? undefined;
  }

  private buildScopeKeys(context: ResolveContext): string[] {
    const keys = [
      buildScopeKey(SetLevel.SYSTEM, {}),
      buildScopeKey(SetLevel.COMPANY, { companyId: context.companyId }),
      buildScopeKey(SetLevel.USER, {
        companyId: context.companyId,
        subjectId: context.userId,
      }),
    ];

    if (context.roleCode) {
      keys.push(
        buildScopeKey(SetLevel.ROLE, {
          companyId: context.companyId,
          subjectId: context.roleCode,
        }),
      );
    }

    return keys;
  }

  private resolveDefinition(
    definition: SetDef,
    values: SetValue[],
    context: ResolveContext,
  ): EffectiveSetting {
    const candidates = values.filter((row) => row.defKey === definition.key);
    if (candidates.length === 0) {
      return {
        key: definition.key,
        value: definition.defaultJson,
        source: SetLevel.SYSTEM,
        valueType: definition.valueType,
        description: definition.description,
      };
    }

    const scopePriority = new Map<string, SetLevel>([
      [buildScopeKey(SetLevel.SYSTEM, {}), SetLevel.SYSTEM],
      [
        buildScopeKey(SetLevel.COMPANY, { companyId: context.companyId }),
        SetLevel.COMPANY,
      ],
      [
        buildScopeKey(SetLevel.ROLE, {
          companyId: context.companyId,
          subjectId: context.roleCode,
        }),
        SetLevel.ROLE,
      ],
      [
        buildScopeKey(SetLevel.USER, {
          companyId: context.companyId,
          subjectId: context.userId,
        }),
        SetLevel.USER,
      ],
    ]);

    const winner = candidates
      .map((row) => ({
        row,
        level: scopePriority.get(row.scopeKey) ?? SetLevel.SYSTEM,
      }))
      .sort(
        (left, right) =>
          SETTING_LEVEL_PRIORITY[right.level] -
          SETTING_LEVEL_PRIORITY[left.level],
      )[0];

    return {
      key: definition.key,
      value: winner?.row.valueJson ?? definition.defaultJson,
      source: winner?.level ?? SetLevel.SYSTEM,
      valueType: definition.valueType,
      description: definition.description,
    };
  }

  private async loadWritableDefinition(key: string): Promise<SetDef> {
    if (isCataloguedPermission(key)) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.INVALID,
        'Settings cannot override permission keys.',
        HttpStatus.FORBIDDEN,
      );
    }

    const definition = await this.prisma.setDef.findUnique({ where: { key } });
    if (!definition || !definition.isPrefOnly) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.INVALID,
        `Unknown or non-writable setting key: ${key}.`,
      );
    }

    return definition;
  }

  private validateValue(definition: SetDef, value: unknown): void {
    switch (definition.valueType) {
      case 'string':
        if (typeof value !== 'string' || value.trim().length === 0) {
          throw invalidValue(definition.key);
        }
        return;
      case 'enum': {
        if (typeof value !== 'string') {
          throw invalidValue(definition.key);
        }
        const allowed = (KERNEL_SETTING_KEYS as readonly string[]).includes(
          definition.key,
        )
          ? SETTING_ENUM_VALUES[definition.key as KernelSettingKey]
          : undefined;
        if (allowed && !allowed.includes(value)) {
          throw invalidValue(definition.key);
        }
        return;
      }
      default:
        throw invalidValue(definition.key);
    }
  }
}

function invalidValue(key: string): SettingsException {
  return new SettingsException(
    SETTINGS_ERROR_CODES.INVALID,
    'Invalid value for setting key: ' + key + '.',
  );
}
