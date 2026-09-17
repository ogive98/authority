import { ACTION_REGISTRY, routeForEntity } from "./actions";
import { formatMoneyTnd } from "./parser";
import { entityKindLabel } from "./entities";
import type {
  ParsedCommand,
  ResolvedEntity,
  ScoredSuggestion,
} from "./types";
import { getHabitBoost } from "./history";

/**
 * Score actions from parse + entity + local habits.
 * No silent auto-pick when entities are ambiguous.
 */
export function rankSuggestions(input: {
  parsed: ParsedCommand;
  entities: ResolvedEntity[];
}): ScoredSuggestion[] {
  const { parsed, entities } = input;
  const primary = entities.length === 1 ? entities[0] : null;
  const money = formatMoneyTnd(parsed.amount);
  const label = primary?.label ?? parsed.personToken ?? "…";

  const out: ScoredSuggestion[] = [];

  for (const action of ACTION_REGISTRY) {
    let score = 40 + parsed.confidence * 20;

    if (parsed.amount != null) {
      if (action.id === "open_entity") score -= 15;
      else score += 18;
    } else if (action.id === "open_entity") {
      score += 25;
    }

    if (primary) {
      if (action.entityKinds.includes(primary.kind)) score += 22;
      else score -= 8;
      if (primary.kind === "supplier" && action.id === "ap_payment") score += 28;
      if (primary.kind === "customer" && action.id === "ar_payment") score += 28;
      if (primary.kind === "supplier" && action.id === "transfer") score += 8;
      if (primary.kind === "customer" && action.id === "transfer") score += 4;
      if (action.id === "transfer") score -= 15; // Treasury pending
    } else if (parsed.personToken) {
      score -= 5;
    }

    score += getHabitBoost(action.id, primary?.id ?? null);

    let description: string;
    switch (action.id) {
      case "transfer":
        description = `Banque AUTHORITY · Treasury pending — ${money}`;
        break;
      case "ap_payment":
        description = `Règlement fournisseur ${label}`;
        break;
      case "ar_payment":
        description = `Encaissement ${money} — ${label}`;
        break;
      case "expense":
        description = `Enregistrer une dépense — ${label}`;
        break;
      case "journal":
        description = `Créer une écriture — ${label}`;
        break;
      case "open_entity":
        description = primary
          ? `${entityKindLabel(primary.kind)} · fiche AUTHORITY`
          : "Voir le compte / profil";
        break;
      default:
        description = action.title;
    }

    out.push({
      id: `${action.id}-${primary?.id ?? "none"}`,
      actionId: action.id,
      icon: action.icon,
      title:
        action.id === "open_entity" ? `Ouvrir ${label}` : action.title,
      description,
      route: routeForEntity(action.id, primary?.kind, {
        entityId: primary?.id,
        amount: parsed.amount,
        label: primary?.label ?? parsed.personToken,
      }),
      score,
      entity: primary,
      amount: parsed.amount,
      currency: parsed.currency,
    });
  }

  out.sort((a, b) => b.score - a.score);
  if (out[0]) out[0] = { ...out[0], relevance: "high" };
  return out;
}
