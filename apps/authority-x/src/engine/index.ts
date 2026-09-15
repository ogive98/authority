import { resolveEntities, entityKindLabel } from "./entities";
import { parseCommand, formatMoneyTnd } from "./parser";
import { rankSuggestions } from "./rank";
import type { ResolvedEntity, SuggestResult } from "./types";

export type { SuggestResult, ScoredSuggestion, ParsedCommand } from "./types";
export { parseCommand, formatMoneyTnd } from "./parser";
export { listHistory, pushHistory, clearHistory } from "./history";
export { entityKindLabel } from "./entities";

export function suggest(query: string): SuggestResult {
  const parsed = parseCommand(query);
  const entities = resolveEntities(parsed.personToken);
  const ambiguous = entities.length > 1;
  const suggestions = ambiguous
    ? []
    : rankSuggestions({ parsed, entities });

  return { parsed, entities, ambiguous, suggestions };
}

/** When several Ahmeds — UI picks one then re-ranks */
export function suggestWithEntity(
  query: string,
  entity: ResolvedEntity,
): SuggestResult {
  const parsed = parseCommand(query);
  const entities = [entity];
  return {
    parsed,
    entities,
    ambiguous: false,
    suggestions: rankSuggestions({ parsed, entities }),
  };
}

export function buildExecutionLog(input: {
  query: string;
  actionTitle: string;
  entity: ResolvedEntity | null;
  amount: number | null;
  route: string;
}): Array<{
  kind: "success" | "processing";
  title: string;
  detail?: string;
  href?: string;
}> {
  const money = formatMoneyTnd(input.amount);
  const contact = input.entity
    ? `${input.entity.label} — ${entityKindLabel(input.entity.kind)}`
    : "Non résolu";

  return [
    { kind: "success", title: "Commande reçue", detail: input.query, href: "/" },
    {
      kind: "success",
      title: "Contact identifié",
      detail: contact,
      href: input.entity?.kind === "customer" ? "/customers" : "/suppliers",
    },
    {
      kind: "success",
      title: "Montant identifié",
      detail: money,
      href: "/finance",
    },
    {
      kind: "success",
      title: "Action sélectionnée",
      detail: input.actionTitle,
      href: input.route,
    },
    {
      kind: "processing",
      title: "Vérification des permissions",
      href: "/settings",
    },
    { kind: "success", title: "Permission confirmée", href: "/settings" },
    {
      kind: "processing",
      title: "Ouverture du workflow",
      href: input.route,
    },
    { kind: "success", title: "Formulaire prérempli", href: input.route },
  ];
}
