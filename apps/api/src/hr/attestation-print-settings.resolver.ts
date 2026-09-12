import { Injectable } from '@nestjs/common';
import { SetLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildScopeKey } from '../settings/settings.constants';
import {
  ATTESTATION_PRINT_SETTING_DEFAULTS,
  ATTESTATION_PRINT_SETTING_KEYS,
  ATTESTATION_PRINT_SETTING_META,
  type AttestationPrintSettingKey,
  type AttestationPrintTemplate,
} from './attestation-print-settings.constants';

/** Prefs seats for attestation PDF (D217) — structural skeleton until human overrides. */
@Injectable()
export class AttestationPrintSettingsResolver {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefinitions(): Promise<void> {
    for (const key of Object.values(ATTESTATION_PRINT_SETTING_KEYS)) {
      await this.prisma.setDef.upsert({
        where: { key },
        update: {
          valueType: 'string',
          defaultJson: ATTESTATION_PRINT_SETTING_DEFAULTS[key],
          description: ATTESTATION_PRINT_SETTING_META[key],
          isPrefOnly: true,
        },
        create: {
          key,
          valueType: 'string',
          defaultJson: ATTESTATION_PRINT_SETTING_DEFAULTS[key],
          description: ATTESTATION_PRINT_SETTING_META[key],
          isPrefOnly: true,
        },
      });
    }
  }

  async getTemplate(companyId: string): Promise<AttestationPrintTemplate> {
    await this.ensureDefinitions();
    const keys = Object.values(ATTESTATION_PRINT_SETTING_KEYS);
    const scopeKey = buildScopeKey(SetLevel.COMPANY, { companyId });
    const [values, defs] = await Promise.all([
      this.prisma.setValue.findMany({
        where: { defKey: { in: keys }, scopeKey, deletedAt: null },
      }),
      this.prisma.setDef.findMany({ where: { key: { in: keys } } }),
    ]);
    const byKey = new Map(values.map((v) => [v.defKey, v.valueJson]));
    const defByKey = new Map(defs.map((d) => [d.key, d.defaultJson]));
    const asString = (key: AttestationPrintSettingKey): string => {
      const raw = byKey.has(key) ? byKey.get(key) : defByKey.get(key);
      if (typeof raw === 'string') return raw;
      return ATTESTATION_PRINT_SETTING_DEFAULTS[key];
    };
    return {
      letterhead: asString(ATTESTATION_PRINT_SETTING_KEYS.LETTERHEAD),
      bodyHtml: asString(ATTESTATION_PRINT_SETTING_KEYS.BODY_HTML),
      footer: asString(ATTESTATION_PRINT_SETTING_KEYS.FOOTER),
    };
  }

  async putTemplate(
    companyId: string,
    patch: Partial<AttestationPrintTemplate>,
  ): Promise<AttestationPrintTemplate> {
    await this.ensureDefinitions();
    const scopeKey = buildScopeKey(SetLevel.COMPANY, { companyId });
    const writes: Array<{ key: AttestationPrintSettingKey; value: string }> =
      [];
    if (patch.letterhead !== undefined) {
      writes.push({
        key: ATTESTATION_PRINT_SETTING_KEYS.LETTERHEAD,
        value: patch.letterhead,
      });
    }
    if (patch.bodyHtml !== undefined) {
      writes.push({
        key: ATTESTATION_PRINT_SETTING_KEYS.BODY_HTML,
        value: patch.bodyHtml,
      });
    }
    if (patch.footer !== undefined) {
      writes.push({
        key: ATTESTATION_PRINT_SETTING_KEYS.FOOTER,
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
