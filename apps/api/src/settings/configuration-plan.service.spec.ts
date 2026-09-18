import { SetConfigPlanStatus, SetLevel } from '@prisma/client';
import { ConfigurationPlanService } from './configuration-plan.service';
import { SETTINGS_ERROR_CODES } from './settings.constants';
import { SettingsException } from './settings.exception';
import type { SettingsService } from './settings.service';

describe('ConfigurationPlanService', () => {
  let settings: {
    getEffective: jest.Mock;
    dryRunUpsert: jest.Mock;
    upsertValue: jest.Mock;
    clearValue: jest.Mock;
  };
  let prisma: {
    setConfigPlan: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    setValue: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let auditService: { append: jest.Mock };
  let outboxService: { enqueue: jest.Mock };
  let plan: ConfigurationPlanService;

  beforeEach(() => {
    settings = {
      getEffective: jest.fn().mockResolvedValue({
        companyId: 'company-a',
        settings: [
          {
            key: 'ui.theme',
            value: 'light',
            source: SetLevel.USER,
            valueType: 'enum',
            description: null,
          },
          {
            key: 'ops.unlock_code',
            value: '',
            source: SetLevel.COMPANY,
            valueType: 'string',
            description: null,
            secretSet: true,
          },
        ],
      }),
      dryRunUpsert: jest.fn(),
      upsertValue: jest.fn().mockResolvedValue({
        key: 'ui.theme',
        value: 'dark',
        source: SetLevel.USER,
      }),
      clearValue: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      setConfigPlan: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      setValue: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sv-1',
          valueJson: 'light',
          deletedAt: null,
        }),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) =>
        Promise.resolve(callback(prisma)),
      ),
    };
    auditService = { append: jest.fn().mockResolvedValue({ id: 'a1' }) };
    outboxService = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    plan = new ConfigurationPlanService(
      settings as unknown as SettingsService,
      prisma as never,
      auditService as never,
      outboxService as never,
    );
  });

  it('builds an ephemeral valid plan with publishAllowed=false', async () => {
    settings.dryRunUpsert.mockResolvedValue({
      ok: true,
      code: null,
      message: null,
      normalizedValue: 'dark',
      emptySecretKeepsPrevious: false,
    });

    const result = await plan.buildPlan({
      userId: 'user-1',
      companyId: 'company-a',
      changes: [{ key: 'ui.theme', value: 'dark', level: 'USER' }],
      reason: 'operator preference',
    });

    expect(result.publishAllowed).toBe(false);
    expect(result.lifecycle).toBeNull();
    expect(result.applyVia).toBe('PUT /api/v1/settings');
    expect(result.status).toBe('valid');
    expect(result.approvalRequired).toBe(false);
    expect(result.changes[0]?.canonicalId).toBe('cfg.ui.theme');
    expect(result.projected?.find((row) => row.key === 'ui.theme')?.value).toBe(
      'dark',
    );
  });

  it('persists a DRAFT when persist=true and plan is valid', async () => {
    settings.dryRunUpsert.mockResolvedValue({
      ok: true,
      code: null,
      message: null,
      normalizedValue: 'dark',
      emptySecretKeepsPrevious: false,
    });
    prisma.setConfigPlan.create.mockResolvedValue({
      id: 'plan-1',
      companyId: 'company-a',
      status: SetConfigPlanStatus.DRAFT,
      riskMax: 'low',
      reason: 'save draft',
      resultJson: {
        status: 'valid',
        riskMax: 'low',
        approvalRequired: false,
        reason: 'save draft',
        changes: [
          {
            key: 'ui.theme',
            canonicalId: 'cfg.ui.theme',
            level: 'USER',
            risk: 'low',
            ok: true,
            code: null,
            message: null,
            secret: false,
            currentValue: 'light',
            proposedValue: 'dark',
            emptySecretKeepsPrevious: false,
            currentSource: 'USER',
          },
        ],
        projected: [],
        summary: { total: 1, valid: 1, invalid: 0, critical: 0, high: 0 },
        generatedAt: '2026-09-18T00:00:00.000Z',
      },
      patchesJson: [{ key: 'ui.theme', value: 'dark', level: 'USER' }],
      createdAt: new Date('2026-09-18T00:00:00.000Z'),
      updatedAt: new Date('2026-09-18T00:00:00.000Z'),
    });

    const result = await plan.buildPlan({
      userId: 'user-1',
      companyId: 'company-a',
      changes: [{ key: 'ui.theme', value: 'dark', level: 'USER' }],
      reason: 'save draft',
      persist: true,
    });

    expect(result.planId).toBe('plan-1');
    expect(result.lifecycle).toBe(SetConfigPlanStatus.DRAFT);
    expect(result.publishAllowed).toBe(true);
    expect(result.applyVia).toContain('/apply');
    expect(auditService.append).toHaveBeenCalled();
    expect(outboxService.enqueue).toHaveBeenCalled();
  });

  it('rejects expertise slots without calling dryRunUpsert', async () => {
    const result = await plan.buildPlan({
      userId: 'user-1',
      companyId: 'company-a',
      changes: [{ key: 'tax.vat', value: 19, level: 'COMPANY' }],
    });

    expect(result.status).toBe('invalid');
    expect(result.changes[0]?.code).toBe(
      SETTINGS_ERROR_CODES.EXPERTISE_REQUIRED,
    );
    expect(result.projected).toBeNull();
    expect(settings.dryRunUpsert).not.toHaveBeenCalled();
  });

  it('redacts secret proposed values', async () => {
    settings.getEffective.mockResolvedValue({
      companyId: 'company-a',
      settings: [
        {
          key: 'identity.smtp.pass',
          value: '',
          source: SetLevel.COMPANY,
          valueType: 'string',
          description: null,
          secretSet: true,
        },
      ],
    });
    settings.dryRunUpsert.mockResolvedValue({
      ok: true,
      code: null,
      message: null,
      normalizedValue: 'super-secret',
      emptySecretKeepsPrevious: false,
    });

    const result = await plan.buildPlan({
      userId: 'user-1',
      companyId: 'company-a',
      changes: [
        {
          key: 'identity.smtp.pass',
          value: 'super-secret',
          level: 'COMPANY',
        },
      ],
    });

    expect(result.status).toBe('valid');
    expect(result.approvalRequired).toBe(true);
    expect(result.changes[0]?.proposedValue).toBe('[redacted]');
    expect(JSON.stringify(result)).not.toContain('super-secret');
  });

  it('blocks apply of high-risk DRAFT until approved', async () => {
    prisma.setConfigPlan.findFirst.mockResolvedValue({
      id: 'plan-high',
      companyId: 'company-a',
      status: SetConfigPlanStatus.DRAFT,
      riskMax: 'high',
      reason: null,
      patchesJson: [
        { key: 'ops.unlock_code', value: '9999', level: 'COMPANY' },
      ],
      resultJson: {
        status: 'valid',
        riskMax: 'high',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 0, high: 1 },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await expect(
      plan.apply({
        companyId: 'company-a',
        planId: 'plan-high',
        actorUserId: 'user-1',
      }),
    ).rejects.toBeInstanceOf(SettingsException);

    try {
      await plan.apply({
        companyId: 'company-a',
        planId: 'plan-high',
        actorUserId: 'user-1',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(SettingsException);
      expect((error as SettingsException).code).toBe(
        SETTINGS_ERROR_CODES.PLAN_APPROVAL_REQUIRED,
      );
    }
    expect(settings.upsertValue).not.toHaveBeenCalled();
  });

  it('applies an approved plan via upsertValue', async () => {
    prisma.setConfigPlan.findFirst.mockResolvedValue({
      id: 'plan-ok',
      companyId: 'company-a',
      status: SetConfigPlanStatus.APPROVED,
      riskMax: 'high',
      reason: null,
      patchesJson: [{ key: 'ui.theme', value: 'dark', level: 'USER' }],
      resultJson: {
        status: 'valid',
        riskMax: 'high',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 0, high: 1 },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    prisma.setConfigPlan.update.mockResolvedValue({
      id: 'plan-ok',
      companyId: 'company-a',
      status: SetConfigPlanStatus.APPLIED,
      riskMax: 'high',
      reason: null,
      patchesJson: [{ key: 'ui.theme', value: 'dark', level: 'USER' }],
      beforePatchesJson: [
        { key: 'ui.theme', level: 'USER', absent: false, value: 'light' },
      ],
      resultJson: {
        status: 'valid',
        riskMax: 'high',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 0, high: 1 },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await plan.apply({
      companyId: 'company-a',
      planId: 'plan-ok',
      actorUserId: 'user-1',
    });

    expect(settings.upsertValue).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'ui.theme',
        value: 'dark',
        level: 'USER',
      }),
    );
    expect(result.lifecycle).toBe(SetConfigPlanStatus.APPLIED);
    expect(result.publishAllowed).toBe(false);
    expect(result.rollbackAllowed).toBe(true);
  });

  it('rolls back an APPLIED plan to N-1 values', async () => {
    prisma.setConfigPlan.findFirst.mockResolvedValue({
      id: 'plan-ok',
      companyId: 'company-a',
      status: SetConfigPlanStatus.APPLIED,
      riskMax: 'low',
      reason: null,
      patchesJson: [{ key: 'ui.theme', value: 'dark', level: 'USER' }],
      beforePatchesJson: [
        { key: 'ui.theme', level: 'USER', absent: false, value: 'light' },
      ],
      resultJson: {
        status: 'valid',
        riskMax: 'low',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 0, high: 0 },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    prisma.setConfigPlan.update.mockResolvedValue({
      id: 'plan-ok',
      companyId: 'company-a',
      status: SetConfigPlanStatus.ROLLED_BACK,
      riskMax: 'low',
      reason: null,
      beforePatchesJson: [
        { key: 'ui.theme', level: 'USER', absent: false, value: 'light' },
      ],
      resultJson: {
        status: 'valid',
        riskMax: 'low',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 0, high: 0 },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await plan.rollback({
      companyId: 'company-a',
      planId: 'plan-ok',
      actorUserId: 'user-1',
    });

    expect(settings.upsertValue).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'ui.theme',
        value: 'light',
        level: 'USER',
      }),
    );
    expect(result.lifecycle).toBe(SetConfigPlanStatus.ROLLED_BACK);
    expect(result.rollbackAllowed).toBe(false);
    expect(outboxService.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'settings.plan.rolled_back.v1',
      }),
    );
  });

  it('clears values that were absent before apply', async () => {
    prisma.setConfigPlan.findFirst.mockResolvedValue({
      id: 'plan-new',
      companyId: 'company-a',
      status: SetConfigPlanStatus.APPLIED,
      riskMax: 'low',
      reason: null,
      beforePatchesJson: [
        { key: 'ui.theme', level: 'USER', absent: true },
      ],
      resultJson: {
        status: 'valid',
        riskMax: 'low',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 0, high: 0 },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    prisma.setConfigPlan.update.mockResolvedValue({
      id: 'plan-new',
      companyId: 'company-a',
      status: SetConfigPlanStatus.ROLLED_BACK,
      riskMax: 'low',
      reason: null,
      beforePatchesJson: [
        { key: 'ui.theme', level: 'USER', absent: true },
      ],
      resultJson: {
        status: 'valid',
        riskMax: 'low',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 0, high: 0 },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await plan.rollback({
      companyId: 'company-a',
      planId: 'plan-new',
      actorUserId: 'user-1',
    });

    expect(settings.clearValue).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'ui.theme',
        level: 'USER',
      }),
    );
    expect(settings.upsertValue).not.toHaveBeenCalled();
  });

  it('rejects rollback without N-1 snapshot', async () => {
    prisma.setConfigPlan.findFirst.mockResolvedValue({
      id: 'plan-legacy',
      companyId: 'company-a',
      status: SetConfigPlanStatus.APPLIED,
      riskMax: 'low',
      reason: null,
      beforePatchesJson: null,
      resultJson: {
        status: 'valid',
        riskMax: 'low',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 0, high: 0 },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    try {
      await plan.rollback({
        companyId: 'company-a',
        planId: 'plan-legacy',
        actorUserId: 'user-1',
      });
      fail('expected SettingsException');
    } catch (error) {
      expect(error).toBeInstanceOf(SettingsException);
      expect((error as SettingsException).code).toBe(
        SETTINGS_ERROR_CODES.PLAN_ROLLBACK_UNAVAILABLE,
      );
    }
  });

  it('moves CRITICAL DRAFT to PENDING_SECOND_APPROVAL on first approve', async () => {
    prisma.setConfigPlan.findFirst.mockResolvedValue({
      id: 'plan-crit',
      companyId: 'company-a',
      status: SetConfigPlanStatus.DRAFT,
      riskMax: 'critical',
      reason: null,
      patchesJson: [
        { key: 'accounting.gl.ar', value: '411000', level: 'COMPANY' },
      ],
      resultJson: {
        status: 'valid',
        riskMax: 'critical',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 1, high: 0 },
      },
      approvedByUserId: null,
      approvedAt: null,
      secondApprovedByUserId: null,
      secondApprovedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    prisma.setConfigPlan.update.mockResolvedValue({
      id: 'plan-crit',
      companyId: 'company-a',
      status: SetConfigPlanStatus.PENDING_SECOND_APPROVAL,
      riskMax: 'critical',
      reason: null,
      resultJson: {
        status: 'valid',
        riskMax: 'critical',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 1, high: 0 },
      },
      approvedByUserId: 'user-1',
      approvedAt: new Date('2026-09-18T10:00:00.000Z'),
      secondApprovedByUserId: null,
      secondApprovedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await plan.approve({
      companyId: 'company-a',
      planId: 'plan-crit',
      actorUserId: 'user-1',
    });

    expect(result.lifecycle).toBe(
      SetConfigPlanStatus.PENDING_SECOND_APPROVAL,
    );
    expect(result.dualControlRequired).toBe(true);
    expect(result.publishAllowed).toBe(false);
    expect(result.approvals?.firstApproverUserId).toBe('user-1');
    expect(auditService.append).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'settings.plan.approve',
      }),
    );
  });

  it('rejects same approver on CRITICAL second approve', async () => {
    prisma.setConfigPlan.findFirst.mockResolvedValue({
      id: 'plan-crit',
      companyId: 'company-a',
      status: SetConfigPlanStatus.PENDING_SECOND_APPROVAL,
      riskMax: 'critical',
      reason: null,
      patchesJson: [],
      resultJson: {
        status: 'valid',
        riskMax: 'critical',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 1, high: 0 },
      },
      approvedByUserId: 'user-1',
      approvedAt: new Date(),
      secondApprovedByUserId: null,
      secondApprovedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    try {
      await plan.approve({
        companyId: 'company-a',
        planId: 'plan-crit',
        actorUserId: 'user-1',
      });
      fail('expected SettingsException');
    } catch (error) {
      expect(error).toBeInstanceOf(SettingsException);
      expect((error as SettingsException).code).toBe(
        SETTINGS_ERROR_CODES.PLAN_SAME_APPROVER,
      );
    }
    expect(prisma.setConfigPlan.update).not.toHaveBeenCalled();
  });

  it('completes CRITICAL dual-control with a distinct second approver', async () => {
    prisma.setConfigPlan.findFirst.mockResolvedValue({
      id: 'plan-crit',
      companyId: 'company-a',
      status: SetConfigPlanStatus.PENDING_SECOND_APPROVAL,
      riskMax: 'critical',
      reason: null,
      patchesJson: [],
      resultJson: {
        status: 'valid',
        riskMax: 'critical',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 1, high: 0 },
      },
      approvedByUserId: 'user-1',
      approvedAt: new Date('2026-09-18T10:00:00.000Z'),
      secondApprovedByUserId: null,
      secondApprovedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    prisma.setConfigPlan.update.mockResolvedValue({
      id: 'plan-crit',
      companyId: 'company-a',
      status: SetConfigPlanStatus.APPROVED,
      riskMax: 'critical',
      reason: null,
      resultJson: {
        status: 'valid',
        riskMax: 'critical',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 1, high: 0 },
      },
      approvedByUserId: 'user-1',
      approvedAt: new Date('2026-09-18T10:00:00.000Z'),
      secondApprovedByUserId: 'user-2',
      secondApprovedAt: new Date('2026-09-18T11:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await plan.approve({
      companyId: 'company-a',
      planId: 'plan-crit',
      actorUserId: 'user-2',
    });

    expect(result.lifecycle).toBe(SetConfigPlanStatus.APPROVED);
    expect(result.publishAllowed).toBe(true);
    expect(result.approvals?.secondApproverUserId).toBe('user-2');
    expect(outboxService.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'settings.plan.second_approved.v1',
      }),
    );
  });

  it('blocks apply of CRITICAL until second approval', async () => {
    prisma.setConfigPlan.findFirst.mockResolvedValue({
      id: 'plan-crit',
      companyId: 'company-a',
      status: SetConfigPlanStatus.PENDING_SECOND_APPROVAL,
      riskMax: 'critical',
      reason: null,
      patchesJson: [
        { key: 'accounting.gl.ar', value: '411000', level: 'COMPANY' },
      ],
      resultJson: {
        status: 'valid',
        riskMax: 'critical',
        changes: [],
        projected: null,
        summary: { total: 1, valid: 1, invalid: 0, critical: 1, high: 0 },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    try {
      await plan.apply({
        companyId: 'company-a',
        planId: 'plan-crit',
        actorUserId: 'user-2',
      });
      fail('expected SettingsException');
    } catch (error) {
      expect(error).toBeInstanceOf(SettingsException);
      expect((error as SettingsException).code).toBe(
        SETTINGS_ERROR_CODES.PLAN_DUAL_CONTROL_REQUIRED,
      );
    }
    expect(settings.upsertValue).not.toHaveBeenCalled();
  });
});
