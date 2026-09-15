/** AUTHORITY X — Command Engine types (Phase 3 · local · no DB writes) */

export type CurrencyCode = "TND";

export type EntityKind = "supplier" | "customer" | "employee" | "contact";

export type ResolvedEntity = {
  id: string;
  kind: EntityKind;
  label: string;
  aliases: string[];
};

export type ParsedCommand = {
  raw: string;
  personToken: string | null;
  amount: number | null;
  currency: CurrencyCode | null;
  confidence: number;
};

export type ActionId =
  | "transfer"
  | "ap_payment"
  | "ar_payment"
  | "expense"
  | "journal"
  | "open_entity";

export type ActionDef = {
  id: ActionId;
  icon: string;
  title: string;
  module: string;
  route: string;
  /** Preferred entity kinds for ranking */
  entityKinds: EntityKind[];
};

export type ScoredSuggestion = {
  id: string;
  actionId: ActionId;
  icon: string;
  title: string;
  description: string;
  route: string;
  score: number;
  relevance?: "high";
  entity: ResolvedEntity | null;
  amount: number | null;
  currency: CurrencyCode | null;
};

export type SuggestResult = {
  parsed: ParsedCommand;
  entities: ResolvedEntity[];
  ambiguous: boolean;
  suggestions: ScoredSuggestion[];
};
