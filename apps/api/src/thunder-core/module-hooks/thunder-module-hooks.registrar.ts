import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleHookRegistry } from '../../modules-registry/catalog/module-hook.registry';
import { THUNDER_INTEL_CONSUMER_ID } from '../intel/intel.constants';
import { THUNDER_JOB_TYPES } from '../thunder.constants';

/**
 * Declares Thunder runtime contributions + enable/disable terrain hooks.
 * Does not build Control/Repair/Marketplace — only prepares module plug points.
 */
@Injectable()
export class ThunderModuleHooksRegistrar implements OnModuleInit {
  private readonly logger = new Logger(ThunderModuleHooksRegistrar.name);

  constructor(private readonly hooks: ModuleHookRegistry) {}

  onModuleInit(): void {
    this.hooks.register('platform', {
      contribution: {
        moduleKey: 'platform',
        consumers: ['audit.tap', 'thunder.echo', 'thunder.rules'],
        jobTypes: [
          THUNDER_JOB_TYPES.hello,
          THUNDER_JOB_TYPES.criticalPing,
        ],
        healthCheckIds: ['platform.thunder.kernel'],
        description: 'Thunder kernel consumers + hello job family',
      },
      onRegister: () => {
        this.logger.log('platform Thunder hooks registered');
      },
      healthChecks: [
        () => ({
          ok: true,
          checkId: 'platform.thunder.kernel',
          message: 'Thunder module hooks registry alive',
        }),
      ],
    });

    this.hooks.register('sales', {
      contribution: {
        moduleKey: 'sales',
        consumers: [THUNDER_INTEL_CONSUMER_ID],
        description: 'Intel observes sales.order.confirmed.v1',
      },
      onEnable: (ctx) => {
        this.logger.log(
          `sales enabled company=${ctx.companyId} — intel consumer ready`,
        );
      },
      onDisable: (ctx) => {
        this.logger.log(
          `sales disabled company=${ctx.companyId} — jobs gated by module state`,
        );
      },
    });

    this.hooks.register('delivery', {
      contribution: {
        moduleKey: 'delivery',
        consumers: [THUNDER_INTEL_CONSUMER_ID],
        description: 'Intel signals on delivery.shipment.failed.v1',
      },
      onEnable: (ctx) => {
        this.logger.log(`delivery enabled company=${ctx.companyId}`);
      },
      onDisable: (ctx) => {
        this.logger.log(`delivery disabled company=${ctx.companyId}`);
      },
    });

    this.hooks.register('inventory', {
      contribution: {
        moduleKey: 'inventory',
        consumers: ['inventory.reserveFromOrder'],
        jobTypes: [
          THUNDER_JOB_TYPES.importBulk,
          THUNDER_JOB_TYPES.moduleGated,
        ],
        description:
          'inventory.reserveFromOrder on sales.order.confirmed.v1 + gated jobs',
      },
    });

    this.hooks.register('finance', {
      contribution: {
        moduleKey: 'finance',
        consumers: [
          THUNDER_INTEL_CONSUMER_ID,
          'finance.openItemFromDelivery',
        ],
        description:
          'Intel + finance.openItemFromDelivery on delivery.shipment.delivered.v1',
      },
      onEnable: (ctx) => {
        this.logger.log(`finance enabled company=${ctx.companyId}`);
      },
      onDisable: (ctx) => {
        this.logger.log(`finance disabled company=${ctx.companyId}`);
      },
    });

    this.hooks.register('accounting', {
      contribution: {
        moduleKey: 'accounting',
        consumers: ['accounting.postFromFinance'],
        description:
          'accounting.postFromFinance on finance invoice/payment/instrument events',
      },
    });

    this.hooks.register('backup', {
      contribution: {
        moduleKey: 'backup',
        jobTypes: [
          THUNDER_JOB_TYPES.backupRetentionRun,
          THUNDER_JOB_TYPES.backupAutoCreate,
          THUNDER_JOB_TYPES.backupSpecificFoldersCreate,
        ],
        healthCheckIds: ['backup.kernel'],
        description:
          'Backup retention + auto-create + specific-folders Thunder jobs (D306–D313)',
      },
    });
  }
}
