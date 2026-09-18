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
  BACKUP_SETTING_DEFAULTS,
  BACKUP_SETTING_KEYS,
  BACKUP_SETTING_META,
  SETTINGS_ERROR_CODES,
  SETTING_ENUM_VALUES,
  SETTING_LEVEL_PRIORITY,
  isStubUntilExpert,
  type BackupSettingKey,
  type ExpertiseSlotStatus,
  type KernelSettingKey,
} from './settings.constants';
import { SettingsException } from './settings.exception';
import { normalizeLocalSubpath } from '../backup/backup-path-security';
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
  /** Seed/demo stub — not a human expert validation (D280). */
  isStub: boolean;
};

export interface ExpertiseCatalogResponse {
  companyId: string;
  /** Slots still empty (PENDING_EXPERT). */
  pendingExpertCount: number;
  /** VALIDATED rows still marked STUB_UNTIL_EXPERT — must be replaced. */
  stubUntilExpertCount: number;
  items: ExpertiseSlotDto[];
}

interface ResolveContext {
  userId: string;
  companyId: string;
  roleCode?: string;
  /** D302 — optional site from tenancy for SITE-level prefs. */
  siteId?: string;
  /**
   * D303 — optional document-type code for DOCUMENT-level prefs
   * (e.g. sales.invoice). Not a document instance UUID.
   */
  documentType?: string;
}

export type SettingWriteLevel =
  | 'USER'
  | 'COMPANY'
  | 'ROLE'
  | 'SITE'
  | 'DOCUMENT';


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
    await this.ensureAllBackupDefinitions();

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
          isStub: isStubUntilExpert(vat.lawRef, null),
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
          isStub: isStubUntilExpert(row.lawRef, row.notes),
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
        isStub: false,
      };
    });

    return {
      companyId,
      pendingExpertCount: items.filter((i) => i.status === 'PENDING_EXPERT')
        .length,
      stubUntilExpertCount: items.filter((i) => i.isStub).length,
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

    const notesTrimmed = dto.notes?.trim() || null;
    if (isStubUntilExpert(lawRef, notesTrimmed)) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.EXPERTISE_STUB_MARKER,
        'Remove STUB_UNTIL_EXPERT from lawRef/notes — accountant must replace demo stubs with a real legal reference.',
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
    const wasStub = isStubUntilExpert(existing?.lawRef, existing?.notes);

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
              notes: notesTrimmed,
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
              notes: notesTrimmed,
            },
          });

      await this.auditService.append(tx, {
        companyId,
        actorUserId,
        action: wasStub
          ? AUDIT_ACTIONS.settingsExpertiseStubReplaced
          : AUDIT_ACTIONS.settingsExpertiseValidate,
        entityType: AUDIT_ENTITY_TYPES.setExpertise,
        entityId: saved.id,
        beforeJson: existing
          ? {
              valueLabel: existing.valueLabel,
              lawRef: existing.lawRef,
              rateBps: existing.rateBps,
              isStub: wasStub,
            }
          : undefined,
        afterJson: {
          slotKey,
          valueLabel,
          lawRef,
          rateBps: saved.rateBps,
          amountMilli: saved.amountMilli,
          expertValidatedAt: saved.expertValidatedAt.toISOString(),
          stubReplaced: wasStub,
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
    level: SettingWriteLevel;
    roleCode?: string;
    documentType?: string;
    actorUserId: string;
    correlationId?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<EffectiveSetting> {
    if (params.level === 'ROLE') {
      const roleCode = params.roleCode?.trim();
      if (!roleCode) {
        throw new SettingsException(
          SETTINGS_ERROR_CODES.INVALID,
          'roleCode is required when level=ROLE.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (params.level === 'SITE' && !params.context.siteId?.trim()) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.SITE_REQUIRED,
        'siteId (tenancy) is required when level=SITE.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const documentType = this.resolveDocumentType(
      params.level,
      params.documentType,
      params.context.documentType,
    );

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

    const { setLevel, subjectId } = this.resolveWriteScope(
      params.level,
      params.context,
      params.roleCode,
      documentType,
    );
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
    if (isSecretSettingKey(definition.key) && !isSecretValueSet(value)) {
      const effective = await this.getEffective(params.context);
      const current = effective.settings.find(
        (row) => row.key === definition.key,
      );
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

  /**
   * Soft-delete a scoped setting value (D300 rollback when key was absent pre-apply).
   * Audits like upsert — never echoes secrets.
   */
  async clearValue(params: {
    context: ResolveContext;
    key: string;
    level: SettingWriteLevel;
    roleCode?: string;
    documentType?: string;
    actorUserId: string;
    correlationId?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    if (params.level === 'ROLE') {
      const roleCode = params.roleCode?.trim();
      if (!roleCode) {
        throw new SettingsException(
          SETTINGS_ERROR_CODES.INVALID,
          'roleCode is required when level=ROLE.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (params.level === 'SITE' && !params.context.siteId?.trim()) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.SITE_REQUIRED,
        'siteId (tenancy) is required when level=SITE.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const documentType = this.resolveDocumentType(
      params.level,
      params.documentType,
      params.context.documentType,
    );

    const definition = await this.loadWritableDefinition(params.key);
    const { setLevel, subjectId } = this.resolveWriteScope(
      params.level,
      params.context,
      params.roleCode,
      documentType,
    );
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

    if (!existing || existing.deletedAt) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.setValue.update({
        where: { id: existing.id },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.auditService.append(tx, {
        companyId: params.context.companyId,
        actorUserId: params.actorUserId,
        action: AUDIT_ACTIONS.settingsValueUpdate,
        entityType: AUDIT_ENTITY_TYPES.setValue,
        entityId: existing.id,
        beforeJson: {
          value: isSecretSettingKey(definition.key)
            ? '[redacted]'
            : existing.valueJson,
        },
        afterJson: {
          key: definition.key,
          level: setLevel,
          scopeKey,
          cleared: true,
        } as Prisma.InputJsonValue,
        ip: params.ip,
        device: params.userAgent,
        correlationId: params.correlationId,
      });

      await this.outboxService.enqueue(tx, {
        companyId: params.context.companyId,
        aggregateType: AUDIT_ENTITY_TYPES.setValue,
        aggregateId: existing.id,
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
            cleared: true,
          },
        } as Prisma.InputJsonValue,
      });
    });
  }

  /**
   * Dry-run the same gates as upsertValue without writing (D297).
   * Used by ConfigurationPlanService — never audits / outbox.
   */
  async dryRunUpsert(params: {
    context: ResolveContext;
    key: string;
    value: unknown;
    level: SettingWriteLevel;
    roleCode?: string;
    documentType?: string;
  }): Promise<{
    ok: boolean;
    code: string | null;
    message: string | null;
    normalizedValue: unknown;
    emptySecretKeepsPrevious: boolean;
  }> {
    try {
      if (params.level === 'ROLE') {
        const roleCode = params.roleCode?.trim();
        if (!roleCode) {
          throw new SettingsException(
            SETTINGS_ERROR_CODES.INVALID,
            'roleCode is required when level=ROLE.',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      if (params.level === 'SITE' && !params.context.siteId?.trim()) {
        throw new SettingsException(
          SETTINGS_ERROR_CODES.SITE_REQUIRED,
          'siteId (tenancy) is required when level=SITE.',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.resolveDocumentType(
        params.level,
        params.documentType,
        params.context.documentType,
      );

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

      if (isSecretSettingKey(definition.key) && !isSecretValueSet(value)) {
        return {
          ok: true,
          code: null,
          message: null,
          normalizedValue: null,
          emptySecretKeepsPrevious: true,
        };
      }

      return {
        ok: true,
        code: null,
        message: null,
        normalizedValue: value,
        emptySecretKeepsPrevious: false,
      };
    } catch (error) {
      if (error instanceof SettingsException) {
        const body = error.getResponse();
        const payload =
          typeof body === 'object' && body !== null
            ? (body as { code?: string; message?: string })
            : {};
        return {
          ok: false,
          code: payload.code ?? error.code,
          message: payload.message ?? error.message,
          normalizedValue: null,
          emptySecretKeepsPrevious: false,
        };
      }
      throw error;
    }
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

  /** Super Admin membership (platform console) — not required for ROLE prefs (D204). */
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

    if (context.siteId) {
      keys.push(
        buildScopeKey(SetLevel.SITE, {
          companyId: context.companyId,
          subjectId: context.siteId,
        }),
      );
    }

    if (context.documentType?.trim()) {
      keys.push(
        buildScopeKey(SetLevel.DOCUMENT, {
          companyId: context.companyId,
          subjectId: context.documentType.trim(),
        }),
      );
    }

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

  private resolveDocumentType(
    level: SettingWriteLevel,
    explicit?: string,
    fromContext?: string,
  ): string | undefined {
    if (level !== 'DOCUMENT') {
      return undefined;
    }
    const code = (explicit ?? fromContext)?.trim();
    if (!code) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.DOCUMENT_TYPE_REQUIRED,
        'documentType is required when level=DOCUMENT (stable type code, not instance id).',
        HttpStatus.BAD_REQUEST,
      );
    }
    return code;
  }

  private resolveWriteScope(
    level: SettingWriteLevel,
    context: ResolveContext,
    roleCode?: string,
    documentType?: string,
  ): { setLevel: SetLevel; subjectId: string } {
    if (level === 'COMPANY') {
      return { setLevel: SetLevel.COMPANY, subjectId: context.companyId };
    }
    if (level === 'SITE') {
      return {
        setLevel: SetLevel.SITE,
        subjectId: context.siteId!.trim(),
      };
    }
    if (level === 'DOCUMENT') {
      return {
        setLevel: SetLevel.DOCUMENT,
        subjectId: documentType!.trim(),
      };
    }
    if (level === 'ROLE') {
      return { setLevel: SetLevel.ROLE, subjectId: roleCode!.trim() };
    }
    return { setLevel: SetLevel.USER, subjectId: context.userId };
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

    if (context.siteId) {
      scopePriority.set(
        buildScopeKey(SetLevel.SITE, {
          companyId: context.companyId,
          subjectId: context.siteId,
        }),
        SetLevel.SITE,
      );
    }

    if (context.documentType?.trim()) {
      scopePriority.set(
        buildScopeKey(SetLevel.DOCUMENT, {
          companyId: context.companyId,
          subjectId: context.documentType.trim(),
        }),
        SetLevel.DOCUMENT,
      );
    }

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

  private async ensureAllBackupDefinitions(): Promise<void> {
    for (const key of BACKUP_SETTING_KEYS) {
      await this.ensureBackupDefinition(key);
    }
  }

  private async ensureBackupDefinition(key: BackupSettingKey): Promise<SetDef> {
    const meta = BACKUP_SETTING_META[key];
    return this.prisma.setDef.upsert({
      where: { key },
      update: {
        valueType: meta.valueType,
        defaultJson: BACKUP_SETTING_DEFAULTS[key] as Prisma.InputJsonValue,
        description: meta.description,
        isPrefOnly: true,
      },
      create: {
        key,
        valueType: meta.valueType,
        defaultJson: BACKUP_SETTING_DEFAULTS[key] as Prisma.InputJsonValue,
        description: meta.description,
        isPrefOnly: true,
      },
    });
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
    if ((Object.values(DUNNING_SETTING_KEYS) as string[]).includes(key)) {
      return this.ensureDunningDefinition(key as DunningSettingKey);
    }
    if ((BACKUP_SETTING_KEYS as readonly string[]).includes(key)) {
      return this.ensureBackupDefinition(key as BackupSettingKey);
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
        if (definition.key === 'backup.destination.localSubpath') {
          try {
            normalizeLocalSubpath(value);
          } catch {
            throw invalidValue(definition.key);
          }
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
        if (
          definition.key === 'backup.retention.keepDays' &&
          (value < 1 || value > 3650 || !Number.isInteger(value))
        ) {
          throw invalidValue(definition.key);
        }
        if (
          definition.key === 'backup.schedule.hourTunis' &&
          (value < 0 || value > 23 || !Number.isInteger(value))
        ) {
          throw invalidValue(definition.key);
        }
        if (
          definition.key === 'backup.autoBackup.hourTunis' &&
          (value < 0 || value > 23 || !Number.isInteger(value))
        ) {
          throw invalidValue(definition.key);
        }
        if (
          definition.key === 'backup.specificFolders.auto.hourTunis' &&
          (value < 0 || value > 23 || !Number.isInteger(value))
        ) {
          throw invalidValue(definition.key);
        }
        if (
          definition.key === 'backup.specificFolders.maxSize' &&
          (value < 1 || value > 1_099_511_627_776 || !Number.isInteger(value))
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
        if (
          definition.key === 'backup.autoBackup.scope' &&
          value !== 'CONFIGURATION' &&
          value !== 'DATABASE'
        ) {
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
    const from = cfg.smtp.from?.trim() || cfg.smtp.user?.trim() || 'AUTHORITY';
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
