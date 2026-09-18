import { randomUUID } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, SetConfigPlanStatus, SetLevel } from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  OUTBOX_EVENT_TYPES,
} from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../audit/outbox.service';
import { listConfigurationCatalog } from '../modules-registry/catalog/configuration-catalog';
import { canonicalConfigurationId } from '../modules-registry/catalog/canonical-ids';
import type { IndexRiskLevel } from '../modules-registry/catalog/authority-index.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildScopeKey,
  EXPERTISE_SLOT_KEYS,
  isSecretSettingKey,
  SETTINGS_ERROR_CODES,
} from './settings.constants';
import { SettingsException } from './settings.exception';
import type { EffectiveSetting } from './settings.service';
import { SettingsService } from './settings.service';

export type ConfigurationPlanChangeInput = {
  key: string;
  value: unknown;
  level?: 'USER' | 'COMPANY' | 'ROLE' | 'SITE' | 'DOCUMENT';
  roleCode?: string;
  documentType?: string;
};

export type ConfigurationPlanChangeResult = {
  key: string;
  canonicalId: string;
  level: 'USER' | 'COMPANY' | 'ROLE' | 'SITE' | 'DOCUMENT';
  risk: IndexRiskLevel;
  ok: boolean;
  code: string | null;
  message: string | null;
  secret: boolean;
  /** Redacted for secrets — never plaintext. */
  currentValue: unknown;
  /** Redacted for secrets — never plaintext. */
  proposedValue: unknown;
  emptySecretKeepsPrevious: boolean;
  currentSource: string | null;
};

export type ConfigurationPlanApprovals = {
  firstApproverUserId: string | null;
  firstApprovedAt: string | null;
  secondApproverUserId: string | null;
  secondApprovedAt: string | null;
};

export type ConfigurationPlanResponse = {
  planId: string;
  generatedAt: string;
  companyId: string;
  /** Validation outcome of the change set. */
  status: 'valid' | 'invalid';
  /** Persistence lifecycle when stored (D298). */
  lifecycle: SetConfigPlanStatus | null;
  riskMax: IndexRiskLevel;
  /** True only when a human may call apply on a persisted plan. */
  publishAllowed: boolean;
  approvalRequired: boolean;
  /** D299 — CRITICAL requires two distinct human approvers. */
  dualControlRequired: boolean;
  /** D300 — APPLIED plan with N-1 snapshot may be rolled back. */
  rollbackAllowed: boolean;
  approvals: ConfigurationPlanApprovals | null;
  applyVia: string;
  reason: string | null;
  changes: ConfigurationPlanChangeResult[];
  /** Projected effective settings after successful patches only (secrets redacted). */
  projected: EffectiveSetting[] | null;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    critical: number;
    high: number;
  };
};

export type ConfigurationPlanListItem = {
  planId: string;
  companyId: string;
  lifecycle: SetConfigPlanStatus;
  riskMax: IndexRiskLevel;
  status: 'valid' | 'invalid';
  reason: string | null;
  createdAt: string;
  approvalRequired: boolean;
  dualControlRequired: boolean;
  rollbackAllowed: boolean;
  publishAllowed: boolean;
};

const RISK_RANK: Record<IndexRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const EXPERTISE_SET = new Set<string>(EXPERTISE_SLOT_KEYS);

type StoredPatch = {
  key: string;
  value: unknown;
  level: 'USER' | 'COMPANY' | 'ROLE' | 'SITE' | 'DOCUMENT';
  roleCode?: string;
  documentType?: string;
};

/** N-1 snapshot row captured at apply (D300). Secrets at rest — never API. */
type StoredBeforePatch = {
  key: string;
  level: 'USER' | 'COMPANY' | 'ROLE' | 'SITE' | 'DOCUMENT';
  roleCode?: string;
  documentType?: string;
  absent: boolean;
  value?: unknown;
};

@Injectable()
export class ConfigurationPlanService {
  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * Build + validate + simulate a configuration plan (D297).
   * Optional persist=true stores a DRAFT when valid (D298).
   */
  async buildPlan(input: {
    userId: string;
    companyId: string;
    roleCode?: string;
    siteId?: string;
    changes: ConfigurationPlanChangeInput[];
    reason?: string;
    persist?: boolean;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }): Promise<ConfigurationPlanResponse> {
    const built = await this.computePlan(input);

    if (!input.persist) {
      return {
        ...built.response,
        planId: randomUUID(),
        lifecycle: null,
        publishAllowed: false,
        applyVia: 'PUT /api/v1/settings',
      };
    }

    if (built.response.status !== 'valid') {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.PLAN_INVALID,
        'Cannot persist an invalid configuration plan.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.setConfigPlan.create({
        data: {
          companyId: input.companyId,
          status: SetConfigPlanStatus.DRAFT,
          riskMax: built.response.riskMax,
          reason: built.response.reason,
          patchesJson: built.patches as Prisma.InputJsonValue,
          resultJson: this.toStoredResult(
            built.response,
          ) as Prisma.InputJsonValue,
          createdByUserId: input.userId,
        },
      });

      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.userId,
        action: AUDIT_ACTIONS.settingsPlanCreate,
        entityType: AUDIT_ENTITY_TYPES.setConfigPlan,
        entityId: row.id,
        afterJson: {
          riskMax: row.riskMax,
          changeCount: built.patches.length,
          approvalRequired: needsApproval(built.response.riskMax),
        },
        ip: input.ip,
        device: input.userAgent,
        correlationId: input.correlationId,
      });

      await this.outboxService.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: AUDIT_ENTITY_TYPES.setConfigPlan,
        aggregateId: row.id,
        eventType: OUTBOX_EVENT_TYPES.settingsPlanCreated,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.settingsPlanCreated,
          eventVersion: 1,
          source: 'settings',
          actorId: input.userId,
          companyId: input.companyId,
          correlationId: input.correlationId ?? null,
          payload: {
            planId: row.id,
            riskMax: row.riskMax,
            approvalRequired: needsApproval(built.response.riskMax),
          },
        },
      });

      return row;
    });

    return this.toResponseFromRow(created);
  }

  async getPlan(
    companyId: string,
    planId: string,
  ): Promise<ConfigurationPlanResponse> {
    const row = await this.findActivePlan(companyId, planId);
    return this.toResponseFromRow(row);
  }

  async listPlans(companyId: string): Promise<ConfigurationPlanListItem[]> {
    const rows = await this.prisma.setConfigPlan.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => {
      const riskMax = row.riskMax as IndexRiskLevel;
      const approvalRequired = needsApproval(riskMax);
      return {
        planId: row.id,
        companyId: row.companyId,
        lifecycle: row.status,
        riskMax,
        status: 'valid',
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
        approvalRequired,
        dualControlRequired: needsDualControl(riskMax),
        rollbackAllowed: canRollback(row.status, row.beforePatchesJson),
        publishAllowed: canPublish(row.status, riskMax),
      };
    });
  }

  async approve(input: {
    companyId: string;
    planId: string;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }): Promise<ConfigurationPlanResponse> {
    const row = await this.findActivePlan(input.companyId, input.planId);
    const riskMax = row.riskMax as IndexRiskLevel;
    const dual = needsDualControl(riskMax);

    if (row.status === SetConfigPlanStatus.DRAFT) {
      const nextStatus = dual
        ? SetConfigPlanStatus.PENDING_SECOND_APPROVAL
        : SetConfigPlanStatus.APPROVED;

      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.setConfigPlan.update({
          where: { id: row.id },
          data: {
            status: nextStatus,
            approvedByUserId: input.actorUserId,
            approvedAt: new Date(),
            version: { increment: 1 },
          },
        });

        await this.auditService.append(tx, {
          companyId: input.companyId,
          actorUserId: input.actorUserId,
          action: AUDIT_ACTIONS.settingsPlanApprove,
          entityType: AUDIT_ENTITY_TYPES.setConfigPlan,
          entityId: row.id,
          beforeJson: { status: row.status },
          afterJson: {
            status: nextStatus,
            dualControlRequired: dual,
            approvalStep: 1,
          },
          ip: input.ip,
          device: input.userAgent,
          correlationId: input.correlationId,
        });

        await this.outboxService.enqueue(tx, {
          companyId: input.companyId,
          aggregateType: AUDIT_ENTITY_TYPES.setConfigPlan,
          aggregateId: row.id,
          eventType: OUTBOX_EVENT_TYPES.settingsPlanApproved,
          payloadJson: {
            eventType: OUTBOX_EVENT_TYPES.settingsPlanApproved,
            eventVersion: 1,
            source: 'settings',
            actorId: input.actorUserId,
            companyId: input.companyId,
            correlationId: input.correlationId ?? null,
            payload: {
              planId: row.id,
              riskMax: row.riskMax,
              dualControlRequired: dual,
              status: nextStatus,
              approvalStep: 1,
            },
          },
        });

        return next;
      });

      return this.toResponseFromRow(updated);
    }

    if (
      dual &&
      row.status === SetConfigPlanStatus.PENDING_SECOND_APPROVAL
    ) {
      if (row.approvedByUserId === input.actorUserId) {
        throw new SettingsException(
          SETTINGS_ERROR_CODES.PLAN_SAME_APPROVER,
          'CRITICAL dual-control requires a distinct second approver.',
          HttpStatus.CONFLICT,
        );
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.setConfigPlan.update({
          where: { id: row.id },
          data: {
            status: SetConfigPlanStatus.APPROVED,
            secondApprovedByUserId: input.actorUserId,
            secondApprovedAt: new Date(),
            version: { increment: 1 },
          },
        });

        await this.auditService.append(tx, {
          companyId: input.companyId,
          actorUserId: input.actorUserId,
          action: AUDIT_ACTIONS.settingsPlanSecondApprove,
          entityType: AUDIT_ENTITY_TYPES.setConfigPlan,
          entityId: row.id,
          beforeJson: { status: row.status },
          afterJson: {
            status: SetConfigPlanStatus.APPROVED,
            dualControlRequired: true,
            approvalStep: 2,
          },
          ip: input.ip,
          device: input.userAgent,
          correlationId: input.correlationId,
        });

        await this.outboxService.enqueue(tx, {
          companyId: input.companyId,
          aggregateType: AUDIT_ENTITY_TYPES.setConfigPlan,
          aggregateId: row.id,
          eventType: OUTBOX_EVENT_TYPES.settingsPlanSecondApproved,
          payloadJson: {
            eventType: OUTBOX_EVENT_TYPES.settingsPlanSecondApproved,
            eventVersion: 1,
            source: 'settings',
            actorId: input.actorUserId,
            companyId: input.companyId,
            correlationId: input.correlationId ?? null,
            payload: {
              planId: row.id,
              riskMax: row.riskMax,
              dualControlRequired: true,
              status: SetConfigPlanStatus.APPROVED,
              approvalStep: 2,
            },
          },
        });

        return next;
      });

      return this.toResponseFromRow(updated);
    }

    throw new SettingsException(
      SETTINGS_ERROR_CODES.PLAN_STATE,
      dual
        ? `Plan must be DRAFT or PENDING_SECOND_APPROVAL to approve (got ${row.status}).`
        : `Plan must be DRAFT to approve (got ${row.status}).`,
      HttpStatus.CONFLICT,
    );
  }

  async reject(input: {
    companyId: string;
    planId: string;
    actorUserId: string;
    reason?: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }): Promise<ConfigurationPlanResponse> {
    const row = await this.findActivePlan(input.companyId, input.planId);
    if (
      row.status !== SetConfigPlanStatus.DRAFT &&
      row.status !== SetConfigPlanStatus.PENDING_SECOND_APPROVAL &&
      row.status !== SetConfigPlanStatus.APPROVED
    ) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.PLAN_STATE,
        `Plan cannot be rejected from ${row.status}.`,
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.setConfigPlan.update({
        where: { id: row.id },
        data: {
          status: SetConfigPlanStatus.REJECTED,
          rejectedByUserId: input.actorUserId,
          rejectedAt: new Date(),
          rejectReason: input.reason?.trim() || null,
          version: { increment: 1 },
        },
      });

      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: AUDIT_ACTIONS.settingsPlanReject,
        entityType: AUDIT_ENTITY_TYPES.setConfigPlan,
        entityId: row.id,
        beforeJson: { status: row.status },
        afterJson: {
          status: SetConfigPlanStatus.REJECTED,
          reason: input.reason?.trim() || null,
        },
        ip: input.ip,
        device: input.userAgent,
        correlationId: input.correlationId,
      });

      await this.outboxService.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: AUDIT_ENTITY_TYPES.setConfigPlan,
        aggregateId: row.id,
        eventType: OUTBOX_EVENT_TYPES.settingsPlanRejected,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.settingsPlanRejected,
          eventVersion: 1,
          source: 'settings',
          actorId: input.actorUserId,
          companyId: input.companyId,
          correlationId: input.correlationId ?? null,
          payload: { planId: row.id },
        },
      });

      return next;
    });

    return this.toResponseFromRow(updated);
  }

  async apply(input: {
    companyId: string;
    planId: string;
    actorUserId: string;
    roleCode?: string;
    siteId?: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }): Promise<ConfigurationPlanResponse> {
    const row = await this.findActivePlan(input.companyId, input.planId);
    const riskMax = row.riskMax as IndexRiskLevel;

    if (!canPublish(row.status, riskMax)) {
      if (
        needsDualControl(riskMax) &&
        row.status === SetConfigPlanStatus.PENDING_SECOND_APPROVAL
      ) {
        throw new SettingsException(
          SETTINGS_ERROR_CODES.PLAN_DUAL_CONTROL_REQUIRED,
          'CRITICAL plan requires a second distinct approver before apply.',
          HttpStatus.CONFLICT,
        );
      }
      if (needsApproval(riskMax) && row.status === SetConfigPlanStatus.DRAFT) {
        throw new SettingsException(
          SETTINGS_ERROR_CODES.PLAN_APPROVAL_REQUIRED,
          needsDualControl(riskMax)
            ? `Risk ${riskMax} requires dual-control APPROVED before apply.`
            : `Risk ${riskMax} requires APPROVED before apply.`,
          HttpStatus.CONFLICT,
        );
      }
      throw new SettingsException(
        SETTINGS_ERROR_CODES.PLAN_STATE,
        `Plan cannot be applied from ${row.status}.`,
        HttpStatus.CONFLICT,
      );
    }

    const patches = row.patchesJson as unknown as StoredPatch[];
    if (!Array.isArray(patches) || patches.length === 0) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.PLAN_INVALID,
        'Plan has no patches to apply.',
      );
    }

    const context = {
      userId: input.actorUserId,
      companyId: input.companyId,
      roleCode: input.roleCode,
      siteId: input.siteId,
    };

    const beforePatches = await this.captureBeforePatches(
      input.companyId,
      patches,
      input.actorUserId,
      input.siteId,
    );

    for (const patch of patches) {
      await this.settings.upsertValue({
        context,
        key: patch.key,
        value: patch.value,
        level: patch.level,
        roleCode: patch.roleCode,
        documentType: patch.documentType,
        actorUserId: input.actorUserId,
        ip: input.ip,
        userAgent: input.userAgent,
        correlationId: input.correlationId,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.setConfigPlan.update({
        where: { id: row.id },
        data: {
          status: SetConfigPlanStatus.APPLIED,
          appliedByUserId: input.actorUserId,
          appliedAt: new Date(),
          beforePatchesJson: beforePatches as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });

      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: AUDIT_ACTIONS.settingsPlanApply,
        entityType: AUDIT_ENTITY_TYPES.setConfigPlan,
        entityId: row.id,
        beforeJson: { status: row.status },
        afterJson: {
          status: SetConfigPlanStatus.APPLIED,
          changeCount: patches.length,
          rollbackSnapshot: true,
        },
        ip: input.ip,
        device: input.userAgent,
        correlationId: input.correlationId,
      });

      await this.outboxService.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: AUDIT_ENTITY_TYPES.setConfigPlan,
        aggregateId: row.id,
        eventType: OUTBOX_EVENT_TYPES.settingsPlanApplied,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.settingsPlanApplied,
          eventVersion: 1,
          source: 'settings',
          actorId: input.actorUserId,
          companyId: input.companyId,
          correlationId: input.correlationId ?? null,
          payload: {
            planId: row.id,
            changeCount: patches.length,
            rollbackAvailable: true,
          },
        },
      });

      return next;
    });

    return this.toResponseFromRow(updated);
  }

  /**
   * D300 — restore N-1 values captured at apply. Human only; one-shot.
   */
  async rollback(input: {
    companyId: string;
    planId: string;
    actorUserId: string;
    roleCode?: string;
    siteId?: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }): Promise<ConfigurationPlanResponse> {
    const row = await this.findActivePlan(input.companyId, input.planId);

    if (row.status !== SetConfigPlanStatus.APPLIED) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.PLAN_STATE,
        `Plan must be APPLIED to rollback (got ${row.status}).`,
        HttpStatus.CONFLICT,
      );
    }

    const before = row.beforePatchesJson as unknown as StoredBeforePatch[] | null;
    if (!Array.isArray(before) || before.length === 0) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.PLAN_ROLLBACK_UNAVAILABLE,
        'No N-1 snapshot on this plan (applied before D300 or empty).',
        HttpStatus.CONFLICT,
      );
    }

    const context = {
      userId: input.actorUserId,
      companyId: input.companyId,
      roleCode: input.roleCode,
      siteId: input.siteId,
    };

    for (const patch of before) {
      if (patch.absent) {
        await this.settings.clearValue({
          context,
          key: patch.key,
          level: patch.level,
          roleCode: patch.roleCode,
          documentType: patch.documentType,
          actorUserId: input.actorUserId,
          ip: input.ip,
          userAgent: input.userAgent,
          correlationId: input.correlationId,
        });
      } else {
        await this.settings.upsertValue({
          context,
          key: patch.key,
          value: patch.value,
          level: patch.level,
          roleCode: patch.roleCode,
          documentType: patch.documentType,
          actorUserId: input.actorUserId,
          ip: input.ip,
          userAgent: input.userAgent,
          correlationId: input.correlationId,
        });
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.setConfigPlan.update({
        where: { id: row.id },
        data: {
          status: SetConfigPlanStatus.ROLLED_BACK,
          rolledBackByUserId: input.actorUserId,
          rolledBackAt: new Date(),
          version: { increment: 1 },
        },
      });

      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: AUDIT_ACTIONS.settingsPlanRollback,
        entityType: AUDIT_ENTITY_TYPES.setConfigPlan,
        entityId: row.id,
        beforeJson: { status: row.status },
        afterJson: {
          status: SetConfigPlanStatus.ROLLED_BACK,
          changeCount: before.length,
        },
        ip: input.ip,
        device: input.userAgent,
        correlationId: input.correlationId,
      });

      await this.outboxService.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: AUDIT_ENTITY_TYPES.setConfigPlan,
        aggregateId: row.id,
        eventType: OUTBOX_EVENT_TYPES.settingsPlanRolledBack,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.settingsPlanRolledBack,
          eventVersion: 1,
          source: 'settings',
          actorId: input.actorUserId,
          companyId: input.companyId,
          correlationId: input.correlationId ?? null,
          payload: {
            planId: row.id,
            changeCount: before.length,
          },
        },
      });

      return next;
    });

    return this.toResponseFromRow(updated);
  }

  private async captureBeforePatches(
    companyId: string,
    patches: StoredPatch[],
    actorUserId: string,
    siteId?: string,
  ): Promise<StoredBeforePatch[]> {
    const out: StoredBeforePatch[] = [];
    for (const patch of patches) {
      const setLevel =
        patch.level === 'COMPANY'
          ? SetLevel.COMPANY
          : patch.level === 'SITE'
            ? SetLevel.SITE
            : patch.level === 'DOCUMENT'
              ? SetLevel.DOCUMENT
              : patch.level === 'ROLE'
                ? SetLevel.ROLE
                : SetLevel.USER;
      const subjectId =
        setLevel === SetLevel.COMPANY
          ? companyId
          : setLevel === SetLevel.SITE
            ? (siteId?.trim() ?? '')
            : setLevel === SetLevel.DOCUMENT
              ? (patch.documentType?.trim() ?? '')
              : setLevel === SetLevel.ROLE
                ? (patch.roleCode?.trim() ?? '')
                : actorUserId;
      const scopeKey = buildScopeKey(setLevel, {
        companyId,
        subjectId,
      });
      const existing = await this.prisma.setValue.findUnique({
        where: {
          defKey_scopeKey: {
            defKey: patch.key,
            scopeKey,
          },
        },
      });
      if (!existing || existing.deletedAt) {
        out.push({
          key: patch.key,
          level: patch.level,
          roleCode: patch.roleCode,
          documentType: patch.documentType,
          absent: true,
        });
      } else {
        out.push({
          key: patch.key,
          level: patch.level,
          roleCode: patch.roleCode,
          documentType: patch.documentType,
          absent: false,
          value: existing.valueJson,
        });
      }
    }
    return out;
  }

  private async computePlan(input: {
    userId: string;
    companyId: string;
    roleCode?: string;
    siteId?: string;
    changes: ConfigurationPlanChangeInput[];
    reason?: string;
  }): Promise<{
    response: Omit<
      ConfigurationPlanResponse,
      'planId' | 'lifecycle' | 'publishAllowed' | 'applyVia'
    > & { approvalRequired: boolean };
    patches: StoredPatch[];
  }> {
    const context = {
      userId: input.userId,
      companyId: input.companyId,
      roleCode: input.roleCode,
      siteId: input.siteId,
    };

    const catalog = new Map(
      listConfigurationCatalog().map((row) => [row.key, row]),
    );
    const effective = await this.settings.getEffective(context);
    const byKey = new Map(effective.settings.map((row) => [row.key, row]));

    const changes: ConfigurationPlanChangeResult[] = [];
    const patches: StoredPatch[] = [];

    for (const patch of input.changes) {
      const level = patch.level ?? 'USER';
      const meta = catalog.get(patch.key);
      const current = byKey.get(patch.key);
      const secret = meta?.secret === true || isSecretSettingKey(patch.key);
      const risk: IndexRiskLevel = meta?.risk ?? 'medium';

      if (EXPERTISE_SET.has(patch.key)) {
        changes.push({
          key: patch.key,
          canonicalId: canonicalConfigurationId(patch.key),
          level,
          risk: 'critical',
          ok: false,
          code: SETTINGS_ERROR_CODES.EXPERTISE_REQUIRED,
          message:
            'Expertise slots require PUT /api/v1/settings/expertise/:slotKey with human validation — not configuration-plan.',
          secret: false,
          currentValue: null,
          proposedValue: null,
          emptySecretKeepsPrevious: false,
          currentSource: null,
        });
        continue;
      }

      const dry = await this.settings.dryRunUpsert({
        context,
        key: patch.key,
        value: patch.value,
        level,
        roleCode: patch.roleCode,
        documentType: patch.documentType,
      });

      changes.push({
        key: patch.key,
        canonicalId: canonicalConfigurationId(patch.key),
        level,
        risk,
        ok: dry.ok,
        code: dry.code,
        message: dry.message,
        secret,
        currentValue: secret
          ? current?.secretSet
            ? '[redacted]'
            : null
          : (current?.value ?? null),
        proposedValue: dry.ok
          ? secret
            ? dry.emptySecretKeepsPrevious
              ? '[unchanged]'
              : '[redacted]'
            : dry.normalizedValue
          : null,
        emptySecretKeepsPrevious: dry.emptySecretKeepsPrevious,
        currentSource: current?.source ?? null,
      });

      if (dry.ok) {
        patches.push({
          key: patch.key,
          value: dry.emptySecretKeepsPrevious
            ? patch.value
            : dry.normalizedValue,
          level,
          roleCode: patch.roleCode,
          documentType: patch.documentType,
        });
      }
    }

    const validChanges = changes.filter((c) => c.ok);
    const status = changes.every((c) => c.ok) ? 'valid' : 'invalid';
    const riskMax = maxRisk(changes.map((c) => c.risk));

    let projected: EffectiveSetting[] | null = null;
    if (status === 'valid') {
      projected = effective.settings.map((row) => {
        const hit = validChanges.find((c) => c.key === row.key);
        if (!hit) {
          return row;
        }
        if (hit.secret) {
          if (hit.emptySecretKeepsPrevious) {
            return row;
          }
          return {
            ...row,
            value: '',
            secretSet: true,
            source: levelToSetLevel(hit.level),
          };
        }
        return {
          ...row,
          value: hit.proposedValue,
          source: levelToSetLevel(hit.level),
        };
      });
    }

    return {
      response: {
        generatedAt: new Date().toISOString(),
        companyId: input.companyId,
        status,
        riskMax,
        approvalRequired: needsApproval(riskMax),
        dualControlRequired: needsDualControl(riskMax),
        rollbackAllowed: false,
        approvals: null,
        reason: input.reason?.trim() || null,
        changes,
        projected,
        summary: {
          total: changes.length,
          valid: validChanges.length,
          invalid: changes.length - validChanges.length,
          critical: changes.filter((c) => c.risk === 'critical').length,
          high: changes.filter((c) => c.risk === 'high').length,
        },
      },
      patches,
    };
  }

  private async findActivePlan(companyId: string, planId: string) {
    const row = await this.prisma.setConfigPlan.findFirst({
      where: { id: planId, companyId, deletedAt: null },
    });
    if (!row) {
      throw new SettingsException(
        SETTINGS_ERROR_CODES.PLAN_NOT_FOUND,
        'Configuration plan not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private toStoredResult(
    response: Awaited<
      ReturnType<ConfigurationPlanService['computePlan']>
    >['response'],
  ) {
    return {
      status: response.status,
      riskMax: response.riskMax,
      approvalRequired: response.approvalRequired,
      reason: response.reason,
      changes: response.changes,
      projected: response.projected,
      summary: response.summary,
      generatedAt: response.generatedAt,
    };
  }

  private toResponseFromRow(row: {
    id: string;
    companyId: string;
    status: SetConfigPlanStatus;
    riskMax: string;
    reason: string | null;
    resultJson: Prisma.JsonValue;
    beforePatchesJson?: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    approvedByUserId?: string | null;
    approvedAt?: Date | null;
    secondApprovedByUserId?: string | null;
    secondApprovedAt?: Date | null;
  }): ConfigurationPlanResponse {
    const stored = row.resultJson as {
      status: 'valid' | 'invalid';
      riskMax: IndexRiskLevel;
      approvalRequired?: boolean;
      reason: string | null;
      changes: ConfigurationPlanChangeResult[];
      projected: EffectiveSetting[] | null;
      summary: ConfigurationPlanResponse['summary'];
      generatedAt?: string;
    };
    const riskMax = (row.riskMax as IndexRiskLevel) || stored.riskMax;
    const approvalRequired = needsApproval(riskMax);
    const dualControlRequired = needsDualControl(riskMax);

    return {
      planId: row.id,
      generatedAt: stored.generatedAt ?? row.createdAt.toISOString(),
      companyId: row.companyId,
      status: stored.status ?? 'valid',
      lifecycle: row.status,
      riskMax,
      publishAllowed: canPublish(row.status, riskMax),
      approvalRequired,
      dualControlRequired,
      rollbackAllowed: canRollback(row.status, row.beforePatchesJson ?? null),
      approvals: {
        firstApproverUserId: row.approvedByUserId ?? null,
        firstApprovedAt: row.approvedAt?.toISOString() ?? null,
        secondApproverUserId: row.secondApprovedByUserId ?? null,
        secondApprovedAt: row.secondApprovedAt?.toISOString() ?? null,
      },
      applyVia: `POST /api/v1/settings/configuration-plan/${row.id}/apply`,
      reason: row.reason ?? stored.reason,
      changes: stored.changes ?? [],
      projected: stored.projected ?? null,
      summary: stored.summary ?? {
        total: 0,
        valid: 0,
        invalid: 0,
        critical: 0,
        high: 0,
      },
    };
  }
}

function needsApproval(risk: IndexRiskLevel): boolean {
  return risk === 'high' || risk === 'critical';
}

function needsDualControl(risk: IndexRiskLevel): boolean {
  return risk === 'critical';
}

function canPublish(
  lifecycle: SetConfigPlanStatus,
  risk: IndexRiskLevel,
): boolean {
  if (lifecycle === SetConfigPlanStatus.APPROVED) {
    return true;
  }
  if (lifecycle === SetConfigPlanStatus.DRAFT && !needsApproval(risk)) {
    return true;
  }
  return false;
}

function canRollback(
  lifecycle: SetConfigPlanStatus,
  beforePatchesJson: Prisma.JsonValue | null | undefined,
): boolean {
  if (lifecycle !== SetConfigPlanStatus.APPLIED) {
    return false;
  }
  return Array.isArray(beforePatchesJson) && beforePatchesJson.length > 0;
}

function maxRisk(risks: IndexRiskLevel[]): IndexRiskLevel {
  let best: IndexRiskLevel = 'low';
  for (const risk of risks) {
    if (RISK_RANK[risk] > RISK_RANK[best]) {
      best = risk;
    }
  }
  return best;
}

function levelToSetLevel(
  level: 'USER' | 'COMPANY' | 'ROLE' | 'SITE' | 'DOCUMENT',
): SetLevel {
  if (level === 'COMPANY') return SetLevel.COMPANY;
  if (level === 'SITE') return SetLevel.SITE;
  if (level === 'DOCUMENT') return SetLevel.DOCUMENT;
  if (level === 'ROLE') return SetLevel.ROLE;
  return SetLevel.USER;
}
