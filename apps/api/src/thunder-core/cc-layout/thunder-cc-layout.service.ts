import { HttpStatus, Injectable } from '@nestjs/common';
import { SetLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildScopeKey } from '../../settings/settings.constants';
import { ThunderException } from '../thunder.exception';
import { THUNDER_ERROR_CODES } from '../thunder.constants';

export const THUNDER_CC_LAYOUT_KEY = 'thunder.cc.layout';

export type ThunderCcLayoutWidget = {
  id: string;
  widgetDefinitionId: string;
  position: { x: number; y: number; w: number; h: number };
  visibility: boolean;
  order: number;
};

export type ThunderCcLayoutPayload = {
  v: 1;
  widgets: ThunderCcLayoutWidget[];
  compact?: boolean;
  thresholds?: Record<string, number>;
  updatedAt?: string;
};

const MAX_WIDGETS = 40;

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : fallback;
  return Math.min(max, Math.max(min, v));
}

/**
 * USER-scoped Thunder Command Center layout (set_def / set_value).
 * Prefers existing Settings storage — no parallel table.
 */
@Injectable()
export class ThunderCcLayoutService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefinition(): Promise<void> {
    await this.prisma.setDef.upsert({
      where: { key: THUNDER_CC_LAYOUT_KEY },
      update: {
        valueType: 'json',
        description: 'Thunder Core Command Center layout (USER)',
        isPrefOnly: true,
      },
      create: {
        key: THUNDER_CC_LAYOUT_KEY,
        valueType: 'json',
        defaultJson: { v: 1, widgets: [] },
        description: 'Thunder Core Command Center layout (USER)',
        isPrefOnly: true,
      },
    });
  }

  async get(
    companyId: string,
    userId: string,
  ): Promise<ThunderCcLayoutPayload | null> {
    await this.ensureDefinition();
    const scopeKey = buildScopeKey(SetLevel.USER, {
      companyId,
      subjectId: userId,
    });
    const row = await this.prisma.setValue.findUnique({
      where: {
        defKey_scopeKey: {
          defKey: THUNDER_CC_LAYOUT_KEY,
          scopeKey,
        },
      },
    });
    if (!row || row.deletedAt) return null;
    return this.sanitize(row.valueJson);
  }

  async put(
    companyId: string,
    userId: string,
    raw: unknown,
  ): Promise<ThunderCcLayoutPayload> {
    await this.ensureDefinition();
    const payload = this.sanitize(raw);
    if (!payload) {
      throw new ThunderException(
        THUNDER_ERROR_CODES.LAYOUT_INVALID,
        'Invalid Thunder CC layout payload.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (payload.widgets.length > MAX_WIDGETS) {
      throw new ThunderException(
        THUNDER_ERROR_CODES.LAYOUT_INVALID,
        `Layout exceeds ${MAX_WIDGETS} widgets.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const scopeKey = buildScopeKey(SetLevel.USER, {
      companyId,
      subjectId: userId,
    });
    const next: ThunderCcLayoutPayload = {
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.setValue.upsert({
      where: {
        defKey_scopeKey: {
          defKey: THUNDER_CC_LAYOUT_KEY,
          scopeKey,
        },
      },
      create: {
        defKey: THUNDER_CC_LAYOUT_KEY,
        level: SetLevel.USER,
        scopeKey,
        companyId,
        valueJson: next,
        version: 1,
      },
      update: {
        valueJson: next,
        deletedAt: null,
        version: { increment: 1 },
      },
    });

    return next;
  }

  sanitize(raw: unknown): ThunderCcLayoutPayload | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    if (o.v !== 1) return null;
    if (!Array.isArray(o.widgets)) return null;

    const widgets: ThunderCcLayoutWidget[] = [];
    for (const item of o.widgets.slice(0, MAX_WIDGETS)) {
      if (!item || typeof item !== 'object') continue;
      const w = item as Record<string, unknown>;
      const id = typeof w.id === 'string' ? w.id.slice(0, 80) : '';
      const widgetDefinitionId =
        typeof w.widgetDefinitionId === 'string'
          ? w.widgetDefinitionId.slice(0, 80)
          : '';
      if (!id || !widgetDefinitionId.startsWith('thunder.')) continue;
      const pos =
        w.position && typeof w.position === 'object'
          ? (w.position as Record<string, unknown>)
          : {};
      widgets.push({
        id,
        widgetDefinitionId,
        position: {
          x: clampInt(pos.x, 0, 11, 0),
          y: clampInt(pos.y, 0, 255, 0),
          w: clampInt(pos.w, 3, 12, 4),
          h: clampInt(pos.h, 2, 5, 2),
        },
        visibility: w.visibility !== false,
        order: clampInt(w.order, 0, 999, widgets.length),
      });
    }

    const thresholds =
      o.thresholds && typeof o.thresholds === 'object'
        ? (o.thresholds as Record<string, number>)
        : undefined;

    return {
      v: 1,
      widgets,
      compact: o.compact === true,
      thresholds,
      updatedAt:
        typeof o.updatedAt === 'string' ? o.updatedAt.slice(0, 40) : undefined,
    };
  }
}
