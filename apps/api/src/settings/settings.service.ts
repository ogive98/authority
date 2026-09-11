import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, SetDef, SetLevel, SetValue } from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  OUTBOX_EVENT_TYPES,
} from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../audit/outbox.service';
import { InviteSettingsResolver } from '../identity/invite-settings.resolver';
import { MailService } from '../mail/mail.service';
import { isCataloguedPermission } from '../permissions/permission.constants';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildScopeKey,
  EXPERTISE_CATALOG,
  isCompanyOnlySettingKey,
  isExpertiseWritableKey,
  isSecretSettingKey,
  isSecretValueSet,
  KERNEL_SETTING_KEYS,
  normalizeOpsUnlockCode,
  OPS_UNLOCK_CODE_DEFAULT,
  OPS_UNLOCK_CODE_KEY,
  SETTINGS_ERROR_CODES,
  SETTING_ENUM_VALUES,
  SETTING_LEVEL_PRIORITY,
  type ExpertiseSlotStatus,
  type KernelSettingKey,
} from './settings.constants';
import { SettingsException } from './settings.exception';
import type { UpsertExpertiseDto } from './upsert-expertise.dto';
import { OpsVisibilityResolver } from './ops-visibility.resolver';
import {
  DUNNING_SETTING_DEFAULTS,
  DUNNING_SETTING_KEYS,
  DUNNING_SETTING_META,
  type DunningSettingKey,
} from '../finance/dunning-settings.constants';

export interface EffectiveSetting {
  key: string;
  value: unknown;
  source: SetLevel;
  valueType: string;
  description: string | null;
  /** True when a secret key has a stored value (value itself never returned). */
  secretSet?: boolean;
}

export interface EffectiveSettingsResponse {
  companyId: string;
  settings: EffectiveSetting[];
}

export type ExpertiseSlotDto = {
  key: string;
  domain: string;
  label: string;
  description: string;
  status: ExpertiseSlotStatus;
  lawRef: string | null;
  valueSummary: string | null;
  manageHref: string | null;
  expertValidatedAt: string | null;
  writable: boolean;
  rateBps: number | null;
  amountMilli: number | null;
  notes: string | null;
};

export interface ExpertiseCatalogResponse {
  companyId: string;
  /** True when any slot still waits for expert rates (never invent). */
  pendingExpertCount: number;
  items: ExpertiseSlotDto[];
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
    private readonly inviteSettings: InviteSettingsResolver,
    private readonly mail: MailService,
    private readonly opsVisibility: OpsVisibilityResolver,
  ) {}

  async getEffective(
    context: ResolveContext,
  ): Promise<EffectiveSettingsResponse> {
    await this.ensureOpsUnlockDefinition();
    await this.opsVisibility.ensureDefinitions();
    await this.ensureCollectionRemindDefinition();
    await this.ensureCreditWarnDefinition();
    await this.ensureAllDunningDefinitions();

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

  /**
   * Préférences → Expertise légale (D090/D091).
   * Lists slots for FODEC / timbre / CNSS / IRPP / TFP / TVA.
   * Stored expert rows override PENDING; VAT comes from Tax Engine only.
   */
  async listExpertise(companyId: string): Promise<ExpertiseCatalogResponse> {
    const vat = await this.resolveVatExpertise(companyId);
    const stored = await this.prisma.setExpertise.findMany({
      where: { companyId, deletedAt: null },
    });
    const byKey = new Map(stored.map((row) => [row.slotKey, row]));

    const items: ExpertiseSlotDto[] = EXPERTISE_CATALOG.map((slot) => {
      const writable = isExpertiseWritableKey(slot.key);
      if (slot.key === 'tax.vat') {
        return {
          key: slot.key,
          domain: slot.domain,
          label: slot.label,
          description: slot.description,
          status: vat.status,
          lawRef: vat.lawRef ?? slot.lawRefHint,
          valueSummary: vat.valueSummary,
          manageHref: slot.manageHref,
          expertValidatedAt: vat.expertValidatedAt,
          writable: false,
          rateBps: null,
          amountMilli: null,
          notes: null,
        };
      }

      const row = byKey.get(slot.key);
      if (row) {
        return {
          key: slot.key,
          domain: slot.domain,
          label: slot.label,
          description: slot.description,
          status: 'VALIDATED',
          lawRef: row.lawRef,
          valueSummary: row.valueLabel,
          manageHref: slot.manageHref,
          expertValidatedAt: row.expertValidatedAt.toISOString(),
          writable,
          rateBps: row.rateBps,
          amountMilli: row.amountMilli,
          notes: row.notes,
        };
      }

      return {
        key: slot.key,
        domain: slot.domain,
        label: slot.label,
        description: slot.description,
        status: slot.defaultStatus,
        lawRef: slot.lawRefHint,
        valueSummary: null,
        manageHref: slot.manageHref,
        expertValidatedAt: null,
        writable,
        rateBps: null,
        amountMilli: null,
        notes: null,
      };
    });

    return {
      companyId,
      pendingExpertCount: items.filter((i) => i.status === 'PENDING_EXPERT')
        .length,
      items,
    };
  }

  /**
   * Expert capture (D091). Requires lawRef + expertValidatedAt + valueLabel.
   * Does not invent rates — caller supplies all values.
   */
  async upsertExpertise(
    companyId: string,
    slotKey: string,
    dto: UpsertExpertiseDto,
    actorUserId: string,
    meta?: { ip?: string; userAgent?: string; correlationId?: string },
  ): Promise<ExpertiseSlotDto> {
    if (!isExpertiseWritableKey(slotKey)) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.EXPERTISE_READONLY,
        'This expertise slot is read-only (use Tax Engine for TVA).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const valueLabel = dto.valueLabel.trim();
    const lawRef = dto.lawRef.trim();
    if (!valueLabel || !lawRef) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.EXPERTISE_REQUIRED,
        'valueLabel and lawRef are required — never invent rates.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const expertValidatedAt = new Date(dto.expertValidatedAt);
    if (Number.isNaN(expertValidatedAt.getTime())) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.INVALID,
        'Invalid expertValidatedAt.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.prisma.setExpertise.findUnique({
      where: {
        companyId_slotKey: { companyId, slotKey },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.setExpertise.update({
            where: { id: existing.id },
            data: {
              valueLabel,
              lawRef,
              expertValidatedAt,
              rateBps: dto.rateBps ?? null,
              amountMilli: dto.amountMilli ?? null,
              notes: dto.notes?.trim() || null,
              deletedAt: null,
              version: { increment: 1 },
            },
          })
        : await tx.setExpertise.create({
            data: {
              companyId,
              slotKey,
              valueLabel,
              lawRef,
              expertValidatedAt,
              rateBps: dto.rateBps ?? null,
              amountMilli: dto.amountMilli ?? null,
              notes: dto.notes?.trim() || null,
            },
          });

      await this.auditService.append(tx, {
        companyId,
        actorUserId,
        action: AUDIT_ACTIONS.settingsExpertiseValidate,
        entityType: AUDIT_ENTITY_TYPES.setExpertise,
        entityId: saved.id,
        beforeJson: existing
          ? {
              valueLabel: existing.valueLabel,
              lawRef: existing.lawRef,
              rateBps: existing.rateBps,
            }
          : undefined,
        afterJson: {
          slotKey,
          valueLabel,
          lawRef,
          rateBps: saved.rateBps,
          amountMilli: saved.amountMilli,
          expertValidatedAt: saved.expertValidatedAt.toISOString(),
        } as Prisma.InputJsonValue,
        ip: meta?.ip,
        device: meta?.userAgent,
        correlationId: meta?.correlationId,
      });

      await this.outboxService.enqueue(tx, {
        companyId,
        aggregateType: AUDIT_ENTITY_TYPES.setExpertise,
        aggregateId: saved.id,
        eventType: OUTBOX_EVENT_TYPES.settingsExpertiseValidated,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.settingsExpertiseValidated,
          eventVersion: 1,
          source: 'settings',
          actorId: actorUserId,
          companyId,
          correlationId: meta?.correlationId ?? null,
          payload: {
            slotKey,
            valueLabel,
            lawRef,
            rateBps: saved.rateBps,
            amountMilli: saved.amountMilli,
            expertValidatedAt: saved.expertValidatedAt.toISOString(),
          },
        } as Prisma.InputJsonValue,
      });
    });

    const catalog = await this.listExpertise(companyId);
    const item = catalog.items.find((i) => i.key === slotKey);
    if (!item) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.INVALID,
        `Expertise slot ${slotKey} could not be resolved.`,
      );
    }
    return item;
  }

  private async resolveVatExpertise(companyId: string): Promise<{
    status: ExpertiseSlotStatus;
    lawRef: string | null;
    valueSummary: string | null;
    expertValidatedAt: string | null;
  }> {
    const codes = await this.prisma.taxCode.findMany({
      where: { companyId, deletedAt: null, active: true, kind: 'VAT' },
      orderBy: { code: 'asc' },
      select: { id: true, code: true },
    });
    if (codes.length === 0) {
      return {
        status: 'PENDING_EXPERT',
        lawRef: null,
        valueSummary: null,
        expertValidatedAt: null,
      };
    }

    const asOf = new Date();
    asOf.setUTCHours(0, 0, 0, 0);
    const summaries: string[] = [];
    let anyValidated: Date | null = null;
    let lawRef: string | null = null;

    for (const code of codes) {
      const rate = await this.prisma.taxRate.findFirst({
        where: {
          companyId,
          taxCodeId: code.id,
          deletedAt: null,
          validFrom: { lte: asOf },
          OR: [{ validTo: null }, { validTo: { gte: asOf } }],
        },
        orderBy: { validFrom: 'desc' },
      });
      if (!rate) continue;
      summaries.push(`${code.code} ${(rate.rateBps / 100).toFixed(0)}%`);
      if (rate.lawRef && !lawRef) lawRef = rate.lawRef;
      if (
        rate.expertValidatedAt &&
        (!anyValidated || rate.expertValidatedAt > anyValidated)
      ) {
        anyValidated = rate.expertValidatedAt;
      }
    }

    if (summaries.length === 0) {
      return {
        status: 'PENDING_EXPERT',
        lawRef: null,
        valueSummary: null,
        expertValidatedAt: null,
      };
    }

    return {
      status: 'VALIDATED',
      lawRef,
      valueSummary: summaries.join(' · '),
      expertValidatedAt: anyValidated?.toISOString() ?? null,
    };
  }

  async upsertValue(params: {
    context: ResolveContext;
    key: string;
    value: unknown;
    level: 'USER' | 'COMPANY' | 'ROLE';
    roleCode?: string;
    actorUserId: string;
    /** Super Admin membership required for ROLE writes (D203 lock 8B). */
    actorIsSuperAdmin: boolean;
    correlationId?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<EffectiveSetting> {
    if (params.level === 'ROLE') {
      if (!params.actorIsSuperAdmin) {
        throw new SettingsException(
          SETTINGS_ERROR_CODES.FORBIDDEN_LEVEL,
          'ROLE settings can only be written by Super Admin.',
          HttpStatus.FORBIDDEN,
        );
      }
      const roleCode = params.roleCode?.trim();
      if (!roleCode) {
        throw new SettingsException(
          SETTINGS_ERROR_CODES.INVALID,
          'roleCode is required when level=ROLE.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (isCompanyOnlySettingKey(params.key) && params.level === 'USER') {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.FORBIDDEN_LEVEL,
        `${params.key} is company-scoped only.`,
        HttpStatus.FORBIDDEN,
      );
    }

    if (params.key.startsWith('ops.')) {
      await this.opsVisibility.ensureDefinitions();
    }

    const definition = await this.loadWritableDefinition(params.key);
    let value = params.value;
    if (params.key === OPS_UNLOCK_CODE_KEY) {
      const normalized = normalizeOpsUnlockCode(params.value);
      if (!normalized) {
        throw invalidValue(params.key);
      }
      value = normalized;
    }
    this.validateValue(definition, value);

    const setLevel =
      params.level === 'COMPANY'
        ? SetLevel.COMPANY
        : params.level === 'ROLE'
          ? SetLevel.ROLE
          : SetLevel.USER;
    const subjectId =
      setLevel === SetLevel.COMPANY
        ? params.context.companyId
        : setLevel === SetLevel.ROLE
          ? params.roleCode!.trim()
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

    // D137 — empty secret write = keep previous (write-only field).
    if (
      isSecretSettingKey(definition.key) &&
      !isSecretValueSet(value)
    ) {
      const effective = await this.getEffective(params.context);
      const current = effective.settings.find((row) => row.key === definition.key);
      if (!current) {
        throw new SettingsException(
          SETTINGS_ERROR_CODES.INVALID,
          `Setting ${definition.key} could not be resolved.`,
        );
      }
      return current;
    }

    const auditValue = isSecretSettingKey(definition.key)
      ? '[redacted]'
      : value;

    await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.setValue.update({
            where: { id: existing.id },
            data: {
              valueJson: value as Prisma.InputJsonValue,
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
              valueJson: value as Prisma.InputJsonValue,
            },
          });

      await this.auditService.append(tx, {
        companyId: params.context.companyId,
        actorUserId: params.actorUserId,
        action: AUDIT_ACTIONS.settingsValueUpdate,
        entityType: AUDIT_ENTITY_TYPES.setValue,
        entityId: saved.id,
        beforeJson: existing
          ? {
              value: isSecretSettingKey(definition.key)
                ? '[redacted]'
                : existing.valueJson,
            }
          : undefined,
        afterJson: {
          key: definition.key,
          level: setLevel,
          scopeKey,
          value: auditValue,
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
            value: auditValue,
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

  /** D203 lock 8B — ROLE prefs write gated on Super Admin membership. */
  async isSuperAdminMember(userId: string): Promise<boolean> {
    const row = await this.prisma.iamSuperAdminMembership.findUnique({
      where: { userId },
    });
    return Boolean(row && row.status === 'ACTIVE');
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
      const base: EffectiveSetting = {
        key: definition.key,
        value: definition.defaultJson,
        source: SetLevel.SYSTEM,
        valueType: definition.valueType,
        description: definition.description,
      };
      return this.redactSecretSetting(base);
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

    const base: EffectiveSetting = {
      key: definition.key,
      value: winner?.row.valueJson ?? definition.defaultJson,
      source: winner?.level ?? SetLevel.SYSTEM,
      valueType: definition.valueType,
      description: definition.description,
    };
    return this.redactSecretSetting(base);
  }

  private redactSecretSetting(row: EffectiveSetting): EffectiveSetting {
    if (!isSecretSettingKey(row.key)) return row;
    return {
      ...row,
      value: '',
      secretSet: isSecretValueSet(row.value),
    };
  }

  private async ensureOpsUnlockDefinition(): Promise<SetDef> {
    return this.prisma.setDef.upsert({
      where: { key: OPS_UNLOCK_CODE_KEY },
      update: {
        valueType: 'string',
        defaultJson: OPS_UNLOCK_CODE_DEFAULT,
        description:
          'Calculator PIN to exit SPECTRE/PATCH/GHOST (company Admin, 4–12 digits)',
        isPrefOnly: true,
      },
      create: {
        key: OPS_UNLOCK_CODE_KEY,
        valueType: 'string',
        defaultJson: OPS_UNLOCK_CODE_DEFAULT,
        description:
          'Calculator PIN to exit SPECTRE/PATCH/GHOST (company Admin, 4–12 digits)',
        isPrefOnly: true,
      },
    });
  }

  private async ensureCollectionRemindDefinition(): Promise<SetDef> {
    return this.prisma.setDef.upsert({
      where: { key: 'finance.collection.remind_days' },
      update: {
        valueType: 'json',
        defaultJson: [1, 7, 15, 30],
        description:
          'Collection milestones as days past due (JSON array). Empty = any overdue.',
        isPrefOnly: true,
      },
      create: {
        key: 'finance.collection.remind_days',
        valueType: 'json',
        defaultJson: [1, 7, 15, 30],
        description:
          'Collection milestones as days past due (JSON array). Empty = any overdue.',
        isPrefOnly: true,
      },
    });
  }

  private async ensureCreditWarnDefinition(): Promise<SetDef> {
    return this.prisma.setDef.upsert({
      where: { key: 'finance.credit.warn_ratio' },
      update: {
        valueType: 'number',
        defaultJson: 0.8,
        description:
          'Credit pressure warn ratio (outstanding/limit). Breach at ≥1. Not tax.',
        isPrefOnly: true,
      },
      create: {
        key: 'finance.credit.warn_ratio',
        valueType: 'number',
        defaultJson: 0.8,
        description:
          'Credit pressure warn ratio (outstanding/limit). Breach at ≥1. Not tax.',
        isPrefOnly: true,
      },
    });
  }

  private async ensureAllDunningDefinitions(): Promise<void> {
    for (const key of Object.values(DUNNING_SETTING_KEYS)) {
      await this.ensureDunningDefinition(key);
    }
  }

  private async ensureDunningDefinition(
    key: DunningSettingKey,
  ): Promise<SetDef> {
    const valueType =
      key === DUNNING_SETTING_KEYS.SMTP_PORT
        ? 'number'
        : key === DUNNING_SETTING_KEYS.SMTP_SECURE
          ? 'boolean'
          : key === DUNNING_SETTING_KEYS.WA_TEMPLATE_BODY_PARAMS
            ? 'json'
            : 'string';
    return this.prisma.setDef.upsert({
      where: { key },
      update: {
        valueType,
        defaultJson: DUNNING_SETTING_DEFAULTS[key],
        description: DUNNING_SETTING_META[key],
        isPrefOnly: true,
      },
      create: {
        key,
        valueType,
        defaultJson: DUNNING_SETTING_DEFAULTS[key],
        description: DUNNING_SETTING_META[key],
        isPrefOnly: true,
      },
    });
  }

  private async loadWritableDefinition(key: string): Promise<SetDef> {
    if (isCataloguedPermission(key)) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.INVALID,
        'Settings cannot override permission keys.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (key === OPS_UNLOCK_CODE_KEY) {
      return this.ensureOpsUnlockDefinition();
    }
    if (key === 'finance.collection.remind_days') {
      return this.ensureCollectionRemindDefinition();
    }
    if (key === 'finance.credit.warn_ratio') {
      return this.ensureCreditWarnDefinition();
    }
    if (
      (Object.values(DUNNING_SETTING_KEYS) as string[]).includes(key)
    ) {
      return this.ensureDunningDefinition(key as DunningSettingKey);
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
    if (definition.key === OPS_UNLOCK_CODE_KEY) {
      if (!normalizeOpsUnlockCode(value)) {
        throw invalidValue(definition.key);
      }
      return;
    }
    switch (definition.valueType) {
      case 'string':
        // Empty string allowed — Préférences Envois (SMTP host, templates override).
        if (typeof value !== 'string') {
          throw invalidValue(definition.key);
        }
        return;
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw invalidValue(definition.key);
        }
        if (
          definition.key === 'finance.credit.warn_ratio' &&
          (value < 0.05 || value > 1)
        ) {
          throw invalidValue(definition.key);
        }
        return;
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw invalidValue(definition.key);
        }
        return;
      case 'json':
        // Arrays/objects allowed (e.g. finance.collection.remind_days).
        if (value === null || typeof value !== 'object') {
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

  /** D150/D154 — SMTP test to actor; audits sent/failed (no secrets). */
  async sendSmtpTest(input: {
    companyId: string;
    actorUserId: string;
    actorEmail: string;
  }): Promise<{ ok: true; to: string; from: string }> {
    const cfg = await this.inviteSettings.resolve(input.companyId);
    if (!this.mail.isConfigured(cfg.smtp)) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.INVALID,
        'SMTP non configuré. Renseignez host (et auth) dans Envois, puis Enregistrer.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const to = input.actorEmail;
    const from =
      cfg.smtp.from?.trim() ||
      cfg.smtp.user?.trim() ||
      'AUTHORITY';
    try {
      await this.mail.send(
        {
          to,
          subject: 'AUTHORITY — test SMTP',
          text: `Test d’envoi SMTP réussi.\n\nDestinataire : ${to}\nSociété : ${input.companyId}\n\n— AUTHORITY`,
          html: `<p>Test d’envoi SMTP réussi.</p><p>Destinataire : <strong>${to}</strong></p><p>— AUTHORITY</p>`,
        },
        cfg.smtp,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Échec envoi SMTP';
      await this.prisma.$transaction(async (tx) => {
        await this.auditService.append(tx, {
          companyId: input.companyId,
          actorUserId: input.actorUserId,
          action: AUDIT_ACTIONS.settingsMailTestFailed,
          entityType: AUDIT_ENTITY_TYPES.iamUser,
          entityId: input.actorUserId,
          afterJson: { to, from, via: 'smtp', error: msg },
        });
      });
      throw new SettingsException(
        SETTINGS_ERROR_CODES.INVALID,
        msg,
        HttpStatus.BAD_GATEWAY,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: AUDIT_ACTIONS.settingsMailTestSent,
        entityType: AUDIT_ENTITY_TYPES.iamUser,
        entityId: input.actorUserId,
        afterJson: { to, from, via: 'smtp' },
      });
    });
    return { ok: true, to, from };
  }
}

function invalidValue(key: string): SettingsException {
  return new SettingsException(
    SETTINGS_ERROR_CODES.INVALID,
    'Invalid value for setting key: ' + key + '.',
  );
}
