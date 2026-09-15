import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createThunderContext } from '../context/thunder-context';
import {
  buildPrefill,
  INTENT_ACTION_MAP,
  routeForIntentAction,
  type IntentActionId,
  type IntentEntityKind,
} from './intent-action-map';
import { IntentEntityResolver } from './intent-entity-resolver.service';
import { parseIntentCommand } from './intent-parse';
import type { IntentPrepareDto } from './intent.dto';

export type IntentSuggestionDto = {
  id: string;
  actionId: IntentActionId;
  icon: string;
  title: string;
  description: string;
  route: string;
  score: number;
  relevance?: 'high';
  prefill: Record<string, string>;
  entity: {
    id: string;
    kind: IntentEntityKind;
    label: string;
    source: 'api' | 'mock';
  } | null;
  amount: number | null;
  currency: string | null;
};

export type IntentPrepareResult = {
  correlationId: string;
  source: 'thunder';
  parsed: ReturnType<typeof parseIntentCommand>;
  entities: Array<{
    id: string;
    kind: IntentEntityKind;
    label: string;
    score: number;
    source: 'api' | 'mock';
  }>;
  ambiguous: boolean;
  suggestions: IntentSuggestionDto[];
  /** Navigate-only Soft Glass contract — never a silent finance write */
  openWorkflow: { href: string; prefill: Record<string, string> } | null;
};

@Injectable()
export class IntentPrepareService {
  constructor(private readonly entities: IntentEntityResolver) {}

  async prepare(input: {
    companyId: string;
    userId: string;
    dto: IntentPrepareDto;
    correlationId?: string;
  }): Promise<IntentPrepareResult> {
    const ctx = createThunderContext({
      source: 'http',
      companyId: input.companyId,
      userId: input.userId,
      correlationId: input.correlationId ?? randomUUID(),
    });

    const parsed = parseIntentCommand(input.dto.raw);
    if (input.dto.amount != null && Number.isFinite(input.dto.amount)) {
      parsed.amount = input.dto.amount;
    }

    let resolved = await this.entities.resolve(
      input.companyId,
      parsed.personToken,
    );

    if (input.dto.entityId && input.dto.entityKind) {
      const picked = resolved.find((e) => e.id === input.dto.entityId);
      if (picked) {
        resolved = [picked];
      } else {
        resolved = [
          {
            id: input.dto.entityId,
            kind: input.dto.entityKind as IntentEntityKind,
            label: parsed.personToken ?? input.dto.entityId,
            score: 100,
            source: 'api',
          },
        ];
      }
    }

    const ambiguous = resolved.length > 1;
    const suggestions = ambiguous
      ? []
      : this.rank(parsed, resolved[0] ?? null);

    const top = suggestions[0] ?? null;

    return {
      correlationId: ctx.correlationId,
      source: 'thunder',
      parsed,
      entities: resolved,
      ambiguous,
      suggestions,
      openWorkflow: top
        ? { href: top.route, prefill: top.prefill }
        : null,
    };
  }

  private rank(
    parsed: ReturnType<typeof parseIntentCommand>,
    primary: {
      id: string;
      kind: IntentEntityKind;
      label: string;
      source: 'api' | 'mock';
    } | null,
  ): IntentSuggestionDto[] {
    const money =
      parsed.amount != null
        ? `${parsed.amount.toLocaleString('fr-TN')} DT`
        : '…';
    const label = primary?.label ?? parsed.personToken ?? '…';
    const out: IntentSuggestionDto[] = [];

    for (const action of INTENT_ACTION_MAP) {
      let score = 40 + parsed.confidence * 20;

      if (parsed.amount != null) {
        if (action.id === 'open_entity') score -= 15;
        else score += 18;
      } else if (action.id === 'open_entity') {
        score += 25;
      }

      if (primary) {
        if (action.entityKinds.includes(primary.kind)) score += 22;
        else score -= 8;
        if (primary.kind === 'supplier' && action.id === 'ap_payment')
          score += 28;
        if (primary.kind === 'customer' && action.id === 'ar_payment')
          score += 28;
        if (primary.kind === 'supplier' && action.id === 'transfer') score += 8;
        if (primary.kind === 'customer' && action.id === 'transfer') score += 4;
        if (action.id === 'transfer') score -= 15;
      } else if (parsed.personToken) {
        score -= 5;
      }

      let description: string;
      switch (action.id) {
        case 'transfer':
          description = `Banque Soft Glass · Treasury pending — ${money}`;
          break;
        case 'ap_payment':
          description = `Règlement fournisseur ${label}`;
          break;
        case 'ar_payment':
          description = `Encaissement ${money} — ${label}`;
          break;
        case 'expense':
          description = `Enregistrer une dépense — ${label}`;
          break;
        case 'journal':
          description = `Créer une écriture — ${label}`;
          break;
        case 'open_entity':
          description = primary
            ? `Fiche Soft Glass · ${label}`
            : 'Voir le compte / profil';
          break;
        default:
          description = action.title;
      }

      const route = routeForIntentAction(
        action.id,
        primary?.kind,
        primary?.id,
        { amount: parsed.amount, label: primary?.label ?? parsed.personToken },
      );
      const prefill = buildPrefill({
        actionId: action.id,
        entityId: primary?.id,
        entityKind: primary?.kind,
        amount: parsed.amount,
        currency: parsed.currency,
        personToken: parsed.personToken,
      });

      out.push({
        id: `${action.id}-${primary?.id ?? 'none'}`,
        actionId: action.id,
        icon: action.icon,
        title:
          action.id === 'open_entity' ? `Ouvrir ${label}` : action.title,
        description,
        route,
        score,
        prefill,
        entity: primary,
        amount: parsed.amount,
        currency: parsed.currency,
      });
    }

    out.sort((a, b) => b.score - a.score);
    if (out[0]) out[0] = { ...out[0], relevance: 'high' };
    return out;
  }
}
