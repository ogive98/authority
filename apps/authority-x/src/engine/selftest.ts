/**
 * Lightweight selftest for AUTHORITY X command engine.
 * Run: npx tsx src/engine/selftest.ts
 */
import { parseCommand } from "./parser";
import { resolveEntities } from "./entities";
import { suggest, suggestWithEntity } from "./index";

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

const p = parseCommand("Ahmed 1000 DT");
assert(p.personToken?.toLowerCase() === "ahmed", "personToken");
assert(p.amount === 1000, "amount");
assert(p.currency === "TND", "currency");

const entities = resolveEntities("Ahmed");
assert(entities.length >= 2, "ambiguous ahmed");

const amb = suggest("Ahmed 1000 DT");
assert(amb.ambiguous === true, "suggest ambiguous");
assert(amb.suggestions.length === 0, "no actions while ambiguous");

const picked = suggestWithEntity("Ahmed 1000 DT", entities[0]);
assert(picked.suggestions.length > 0, "ranked after pick");
assert(picked.suggestions[0].relevance === "high", "top relevance");

console.log("authority-x engine selftest OK");
