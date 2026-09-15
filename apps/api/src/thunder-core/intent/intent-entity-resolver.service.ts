import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { IntentEntityKind } from './intent-action-map';

export type ResolvedIntentEntity = {
  id: string;
  kind: IntentEntityKind;
  label: string;
  score: number;
  source: 'api' | 'mock';
};

const MOCK_FALLBACK: Array<{
  id: string;
  kind: IntentEntityKind;
  label: string;
  aliases: string[];
}> = [
  {
    id: 'sup-ahmed-benali',
    kind: 'supplier',
    label: 'Ahmed Ben Ali',
    aliases: ['ahmed', 'ahmed ben ali', 'ben ali'],
  },
  {
    id: 'cus-ahmed-trabelsi',
    kind: 'customer',
    label: 'Ahmed Trabelsi',
    aliases: ['ahmed', 'ahmed trabelsi', 'trabelsi'],
  },
  {
    id: 'emp-ahmed-mansour',
    kind: 'employee',
    label: 'Ahmed Mansour',
    aliases: ['ahmed', 'ahmed mansour', 'mansour'],
  },
  {
    id: 'sup-mohamed',
    kind: 'supplier',
    label: 'Mohamed Saïdi',
    aliases: ['mohamed', 'mohamed saidi', 'saidi', 'saïdi'],
  },
  {
    id: 'cus-abc',
    kind: 'customer',
    label: 'ABC Fromagerie',
    aliases: ['abc', 'abc fromagerie'],
  },
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim();
}

@Injectable()
export class IntentEntityResolver {
  private readonly logger = new Logger(IntentEntityResolver.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    companyId: string,
    personToken: string | null,
  ): Promise<ResolvedIntentEntity[]> {
    if (!personToken || personToken.trim().length < 2) return [];

    const q = personToken.trim();
    try {
      const apiHits = await this.resolveFromApi(companyId, q);
      if (apiHits.length > 0) return this.collapseAmbiguity(apiHits);
    } catch (err) {
      this.logger.warn(
        `entity resolve API failed — mock fallback: ${(err as Error).message}`,
      );
    }

    return this.collapseAmbiguity(this.resolveFromMock(q));
  }

  private async resolveFromApi(
    companyId: string,
    q: string,
  ): Promise<ResolvedIntentEntity[]> {
    const [customers, suppliers] = await Promise.all([
      this.prisma.cusCustomer.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { nickname: { contains: q, mode: 'insensitive' } },
            { party: { legalName: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: { party: true },
        take: 12,
      }),
      this.prisma.supSupplier.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { party: { legalName: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: { party: true },
        take: 12,
      }),
    ]);

    const out: ResolvedIntentEntity[] = [];
    const nq = norm(q);

    for (const c of customers) {
      const label = c.nickname?.trim() || c.party.legalName;
      out.push({
        id: c.id,
        kind: 'customer',
        label,
        score: scoreLabel(label, c.code, nq),
        source: 'api',
      });
    }
    for (const s of suppliers) {
      const label = s.party.legalName;
      out.push({
        id: s.id,
        kind: 'supplier',
        label,
        score: scoreLabel(label, s.code, nq),
        source: 'api',
      });
    }

    return out.filter((e) => e.score > 0).sort((a, b) => b.score - a.score);
  }

  private resolveFromMock(q: string): ResolvedIntentEntity[] {
    const nq = norm(q);
    return MOCK_FALLBACK.map((e) => {
      const hay = [e.label, ...e.aliases].map(norm);
      let score = 0;
      for (const h of hay) {
        if (h === nq) score = Math.max(score, 100);
        else if (h.startsWith(nq) || nq.startsWith(h)) score = Math.max(score, 80);
        else if (h.includes(nq) || nq.includes(h)) score = Math.max(score, 55);
      }
      return {
        id: e.id,
        kind: e.kind,
        label: e.label,
        score,
        source: 'mock' as const,
      };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  private collapseAmbiguity(
    scored: ResolvedIntentEntity[],
  ): ResolvedIntentEntity[] {
    if (scored.length === 0) return [];
    const top = scored[0].score;
    const near = scored.filter((x) => x.score >= Math.min(top, 80));
    if (near.length > 1) return near;
    return [scored[0]];
  }
}

function scoreLabel(label: string, code: string, nq: string): number {
  const hay = [norm(label), norm(code)];
  let score = 0;
  for (const h of hay) {
    if (!h) continue;
    if (h === nq) score = Math.max(score, 100);
    else if (h.startsWith(nq) || nq.startsWith(h)) score = Math.max(score, 80);
    else if (h.includes(nq) || nq.includes(h)) score = Math.max(score, 55);
  }
  return score;
}
