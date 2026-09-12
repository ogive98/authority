import { Injectable } from '@nestjs/common';
import { SetLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildScopeKey } from '../settings/settings.constants';
import {
  CONTRACT_PRINT_SETTING_DEFAULTS,
  CONTRACT_PRINT_SETTING_KEYS,
  CONTRACT_PRINT_SETTING_META,
  type ContractPrintSettingKey,
  type ContractPrintTemplate,
} from './contract-print-settings.constants';

/** Prefs seats for contract PDF header/body/footer (D216) — empty until human. */
@Injectable()
export class ContractPrintSettingsResolver {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefinitions(): Promise<void> {
    for (const key of Object.values(CONTRACT_PRINT_SETTING_KEYS)) {
      await this.prisma.setDef.upsert({
        where: { key },
        update: {
          valueType: 'string',
          defaultJson: CONTRACT_PRINT_SETTING_DEFAULTS[key],
          description: CONTRACT_PRINT_SETTING_META[key],
          isPrefOnly: true,
        },
        create: {
          key,
          valueType: 'string',
          defaultJson: CONTRACT_PRINT_SETTING_DEFAULTS[key],
          description: CONTRACT_PRINT_SETTING_META[key],
          isPrefOnly: true,
        },
      });
    }
  }

  async getTemplate(companyId: string): Promise<ContractPrintTemplate> {
    await this.ensureDefinitions();
    const keys = Object.values(CONTRACT_PRINT_SETTING_KEYS);
    const scopeKey = buildScopeKey(SetLevel.COMPANY, { companyId });
    const [values, defs] = await Promise.all([
      this.prisma.setValue.findMany({
        where: { defKey: { in: keys }, scopeKey, deletedAt: null },
      }),
      this.prisma.setDef.findMany({ where: { key: { in: keys } } }),
    ]);
    const byKey = new Map(values.map((v) => [v.defKey, v.valueJson]));
    const defByKey = new Map(defs.map((d) => [d.key, d.defaultJson]));
    const asString = (key: ContractPrintSettingKey): string => {
      const raw = byKey.has(key) ? byKey.get(key) : defByKey.get(key);
      if (typeof raw === 'string') return raw;
      return CONTRACT_PRINT_SETTING_DEFAULTS[key];
    };
    return {
      letterhead: asString(CONTRACT_PRINT_SETTING_KEYS.LETTERHEAD),
      bodyHtml: asString(CONTRACT_PRINT_SETTING_KEYS.BODY_HTML),
      footer: asString(CONTRACT_PRINT_SETTING_KEYS.FOOTER),
    };
  }

  async putTemplate(
    companyId: string,
    patch: Partial<ContractPrintTemplate>,
  ): Promise<ContractPrintTemplate> {
    await this.ensureDefinitions();
    const scopeKey = buildScopeKey(SetLevel.COMPANY, { companyId });
    const writes: Array<{ key: ContractPrintSettingKey; value: string }> = [];
    if (patch.letterhead !== undefined) {
      writes.push({
        key: CONTRACT_PRINT_SETTING_KEYS.LETTERHEAD,
        value: patch.letterhead,
      });
    }
    if (patch.bodyHtml !== undefined) {
      writes.push({
        key: CONTRACT_PRINT_SETTING_KEYS.BODY_HTML,
        value: patch.bodyHtml,
      });
    }
    if (patch.footer !== undefined) {
      writes.push({
        key: CONTRACT_PRINT_SETTING_KEYS.FOOTER,
        value: patch.footer,
      });
    }
    for (const w of writes) {
      const existing = await this.prisma.setValue.findUnique({
        where: { defKey_scopeKey: { defKey: w.key, scopeKey } },
      });
      if (existing) {
        await this.prisma.setValue.update({
          where: { id: existing.id },
          data: {
            valueJson: w.value,
            deletedAt: null,
            version: { increment: 1 },
          },
        });
      } else {
        await this.prisma.setValue.create({
          data: {
            defKey: w.key,
            level: SetLevel.COMPANY,
            scopeKey,
            companyId,
            valueJson: w.value,
          },
        });
      }
    }
    return this.getTemplate(companyId);
  }
}
