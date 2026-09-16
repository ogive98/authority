/**
 * Thunder bridge — Phase 4.
 * Tries POST /api/v1/thunder/intents/prepare; falls back to local engine.
 */

import { suggest, suggestWithEntity } from "./index";
import type { ResolvedEntity, SuggestResult, ScoredSuggestion } from "./types";
import { deviceAuthHeaders } from "../device-auth";

const API_BASE =
  (import.meta as { env?: { VITE_AUTHORITY_API?: string } }).env
    ?.VITE_AUTHORITY_API ?? "http://127.0.0.1:3001";

export type BridgeMeta = {
  source: "thunder" | "local";
  correlationId?: string;
  online: boolean;
};

export type BridgeResult = SuggestResult & {
  bridge: BridgeMeta;
  openWorkflow: { href: string; prefill: Record<string, string> } | null;
};

type ThunderPrepareResponse = {
  correlationId: string;
  source: "thunder";
  parsed: SuggestResult["parsed"];
  entities: Array<{
    id: string;
    kind: ResolvedEntity["kind"];
    label: string;
    score: number;
    source: "api" | "mock";
  }>;
  ambiguous: boolean;
  suggestions: Array<{
    id: string;
    actionId: ScoredSuggestion["actionId"];
    icon: string;
    title: string;
    description: string;
    route: string;
    score: number;
    relevance?: "high";
    prefill: Record<string, string>;
    entity: {
      id: string;
      kind: ResolvedEntity["kind"];
      label: string;
      source: "api" | "mock";
    } | null;
    amount: number | null;
    currency: string | null;
  }>;
  openWorkflow: { href: string; prefill: Record<string, string> } | null;
};

function toLocalEntity(
  e: ThunderPrepareResponse["entities"][number],
): ResolvedEntity {
  return {
    id: e.id,
    kind: e.kind,
    label: e.label,
    aliases: [e.label],
  };
}

function mapThunder(res: ThunderPrepareResponse): BridgeResult {
  const entities = res.entities.map(toLocalEntity);
  const suggestions: ScoredSuggestion[] = res.suggestions.map((s) => ({
    id: s.id,
    actionId: s.actionId,
    icon: s.icon,
    title: s.title,
    description: s.description,
    route: s.route,
    score: s.score,
    relevance: s.relevance,
    entity: s.entity
      ? {
          id: s.entity.id,
          kind: s.entity.kind,
          label: s.entity.label,
          aliases: [s.entity.label],
        }
      : null,
    amount: s.amount,
    currency: (s.currency as ScoredSuggestion["currency"]) ?? null,
  }));

  return {
    parsed: res.parsed,
    entities,
    ambiguous: res.ambiguous,
    suggestions,
    openWorkflow: res.openWorkflow,
    bridge: {
      source: "thunder",
      correlationId: res.correlationId,
      online: true,
    },
  };
}

function mapLocal(
  local: SuggestResult,
  openWorkflow: BridgeResult["openWorkflow"] = null,
): BridgeResult {
  return {
    ...local,
    openWorkflow:
      openWorkflow ??
      (local.suggestions[0]
        ? {
            href: local.suggestions[0].route,
            prefill: {
              actionId: local.suggestions[0].actionId,
              source: "authority_x_local",
            },
          }
        : null),
    bridge: { source: "local", online: false },
  };
}

export async function prepareIntent(input: {
  raw: string;
  entity?: ResolvedEntity | null;
  signal?: AbortSignal;
}): Promise<BridgeResult> {
  const raw = input.raw.trim();
  if (!raw) {
    return mapLocal({
      parsed: {
        raw: "",
        personToken: null,
        amount: null,
        currency: null,
        confidence: 0,
      },
      entities: [],
      ambiguous: false,
      suggestions: [],
    });
  }

  try {
    const body: Record<string, unknown> = { raw };
    if (input.entity) {
      body.entityId = input.entity.id;
      body.entityKind = input.entity.kind;
    }

    const res = await fetch(`${API_BASE}/api/v1/thunder/intents/prepare`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...deviceAuthHeaders(),
      },
      body: JSON.stringify(body),
      signal: input.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as ThunderPrepareResponse;
    return mapThunder(json);
  } catch {
    if (input.entity) return mapLocal(suggestWithEntity(raw, input.entity));
    return mapLocal(suggest(raw));
  }
}
