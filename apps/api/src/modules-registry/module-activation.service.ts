import { HttpStatus, Injectable } from '@nestjs/common';
import { ModModuleStatus } from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  OUTBOX_EVENT_TYPES,
} from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleCatalogService } from './catalog/module-catalog.service';
import { ModuleLifecycleService } from './catalog/module-lifecycle.service';
import { MODULE_ERROR_CODES } from './modules.constants';
import { ModulesException } from './modules.exception';

export interface ModuleActivationActor {
  userId: string;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}

export interface ModuleActivationResult {
  companyId: string;
  moduleKey: string;
  status: ModModuleStatus;
  changed: boolean;
  health: string;
}

@Injectable()
export class ModuleActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: ModuleCatalogService,
    private readonly lifecycle: ModuleLifecycleService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async listForCompany(companyId: string) {
    await this.assertCompany(companyId);
    const states = await this.prisma.modModuleState.findMany({
      where: { companyId },
      orderBy: { moduleKey: 'asc' },
    });

    return Promise.all(
      states.map(async (row) => {
        const health = await this.lifecycle.evaluateCompanyHealth(
          companyId,
          row.moduleKey,
        );
        const manifest = this.catalog.getByKey(row.moduleKey);
        return {
          key: row.moduleKey,
          status: row.status,
          name: manifest?.name ?? null,
          lifecycle: health.processState,
          health: health.health,
          missingRequiredDependencies: health.missingRequiredDependencies,
        };
      }),
    );
  }

  async enable(
    companyId: string,
    moduleKey: string,
    actor: ModuleActivationActor,
  ): Promise<ModuleActivationResult> {
    await this.assertCompany(companyId);
    this.assertCatalogued(moduleKey);

    const existing = await this.prisma.modModuleState.findUnique({
      where: { companyId_moduleKey: { companyId, moduleKey } },
    });

    if (existing?.status === ModModuleStatus.ENABLED) {
      const health = await this.lifecycle.evaluateCompanyHealth(
        companyId,
        moduleKey,
      );
      return {
        companyId,
        moduleKey,
        status: ModModuleStatus.ENABLED,
        changed: false,
        health: health.health,
      };
    }

    const gate = await this.lifecycle.canEnable(companyId, moduleKey);
    if (!gate.ok) {
      throw new ModulesException(
        MODULE_ERROR_CODES.DEPS_MISSING,
        `Required dependencies not ENABLED: ${gate.missingRequiredDependencies.join(', ')}`,
        HttpStatus.CONFLICT,
        { missingRequiredDependencies: gate.missingRequiredDependencies },
      );
    }

    const before = existing?.status ?? null;
    const row = await this.prisma.$transaction(async (tx) => {
      const upserted = await tx.modModuleState.upsert({
        where: { companyId_moduleKey: { companyId, moduleKey } },
        update: { status: ModModuleStatus.ENABLED, version: { increment: 1 } },
        create: {
          companyId,
          moduleKey,
          status: ModModuleStatus.ENABLED,
        },
      });

      await this.audit.append(tx, {
        companyId,
        actorUserId: actor.userId,
        action: AUDIT_ACTIONS.moduleEnable,
        entityType: AUDIT_ENTITY_TYPES.modModuleState,
        entityId: upserted.id,
        beforeJson: { status: before },
        afterJson: {
          status: upserted.status,
          moduleKey,
        },
        ip: actor.ip,
        device: actor.userAgent,
        correlationId: actor.correlationId,
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: AUDIT_ENTITY_TYPES.modModuleState,
        aggregateId: upserted.id,
        eventType: OUTBOX_EVENT_TYPES.moduleEnabled,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.moduleEnabled,
          companyId,
          moduleKey,
          status: upserted.status,
        },
      });

      return upserted;
    });

    const health = await this.lifecycle.evaluateCompanyHealth(
      companyId,
      moduleKey,
    );
    return {
      companyId,
      moduleKey,
      status: row.status,
      changed: true,
      health: health.health,
    };
  }

  async disable(
    companyId: string,
    moduleKey: string,
    actor: ModuleActivationActor,
    opts?: { force?: boolean },
  ): Promise<ModuleActivationResult> {
    await this.assertCompany(companyId);
    this.assertCatalogued(moduleKey);

    const existing = await this.prisma.modModuleState.findUnique({
      where: { companyId_moduleKey: { companyId, moduleKey } },
    });

    if (!existing || existing.status === ModModuleStatus.DISABLED) {
      if (!existing) {
        const created = await this.prisma.$transaction(async (tx) => {
          const row = await tx.modModuleState.create({
            data: {
              companyId,
              moduleKey,
              status: ModModuleStatus.DISABLED,
            },
          });
          await this.audit.append(tx, {
            companyId,
            actorUserId: actor.userId,
            action: AUDIT_ACTIONS.moduleDisable,
            entityType: AUDIT_ENTITY_TYPES.modModuleState,
            entityId: row.id,
            beforeJson: { status: null },
            afterJson: {
              status: row.status,
              moduleKey,
              noop: true,
            },
            ip: actor.ip,
            device: actor.userAgent,
            correlationId: actor.correlationId,
          });
          return row;
        });
        return {
          companyId,
          moduleKey,
          status: created.status,
          changed: false,
          health: 'INACTIVE',
        };
      }
      return {
        companyId,
        moduleKey,
        status: ModModuleStatus.DISABLED,
        changed: false,
        health: 'INACTIVE',
      };
    }

    if (!opts?.force) {
      const dependents = await this.findEnabledDependents(companyId, moduleKey);
      if (dependents.length > 0) {
        throw new ModulesException(
          MODULE_ERROR_CODES.HAS_DEPENDENTS,
          `Cannot disable ${moduleKey}: dependents still ENABLED (${dependents.join(', ')})`,
          HttpStatus.CONFLICT,
          { dependents },
        );
      }
    }

    const before = existing.status;
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.modModuleState.update({
        where: { companyId_moduleKey: { companyId, moduleKey } },
        data: { status: ModModuleStatus.DISABLED, version: { increment: 1 } },
      });

      await this.audit.append(tx, {
        companyId,
        actorUserId: actor.userId,
        action: AUDIT_ACTIONS.moduleDisable,
        entityType: AUDIT_ENTITY_TYPES.modModuleState,
        entityId: updated.id,
        beforeJson: { status: before },
        afterJson: {
          status: updated.status,
          moduleKey,
          force: opts?.force === true,
        },
        ip: actor.ip,
        device: actor.userAgent,
        correlationId: actor.correlationId,
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: AUDIT_ENTITY_TYPES.modModuleState,
        aggregateId: updated.id,
        eventType: OUTBOX_EVENT_TYPES.moduleDisabled,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.moduleDisabled,
          companyId,
          moduleKey,
          status: updated.status,
        },
      });

      return updated;
    });

    return {
      companyId,
      moduleKey,
      status: row.status,
      changed: true,
      health: 'INACTIVE',
    };
  }

  private async findEnabledDependents(
    companyId: string,
    moduleKey: string,
  ): Promise<string[]> {
    const dependents: string[] = [];
    for (const manifest of this.catalog.list()) {
      if (!(manifest.dependencies ?? []).includes(moduleKey)) {
        continue;
      }
      const row = await this.prisma.modModuleState.findUnique({
        where: {
          companyId_moduleKey: { companyId, moduleKey: manifest.id },
        },
      });
      if (row?.status === ModModuleStatus.ENABLED) {
        dependents.push(manifest.id);
      }
    }
    return dependents.sort();
  }

  private assertCatalogued(moduleKey: string): void {
    if (!this.catalog.getByKey(moduleKey)) {
      throw new ModulesException(
        MODULE_ERROR_CODES.UNKNOWN_MODULE,
        `Unknown module: ${moduleKey}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async assertCompany(companyId: string): Promise<void> {
    const company = await this.prisma.orgCompany.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) {
      throw new ModulesException(
        MODULE_ERROR_CODES.COMPANY_NOT_FOUND,
        `Company not found: ${companyId}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
