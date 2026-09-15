import type { CurrencyCode, ParsedCommand } from "./types";

/**
 * Deterministic FR/TN command parser — no AI.
 * Examples: "Ahmed 1000 DT", "verse 500 à Mohamed", "1 000 dinars"
 */
export function parseCommand(rawInput: string): ParsedCommand {
  const raw = rawInput.trim().replace(/\s+/g, " ");
  if (!raw) {
    return {
      raw: "",
      personToken: null,
      amount: null,
      currency: null,
      confidence: 0,
    };
  }

  let currency: CurrencyCode | null = null;
  let working = raw;

  if (/\b(dt|tnd|dinars?)\b/i.test(working)) {
    currency = "TND";
    working = working.replace(/\b(dt|tnd|dinars?)\b/gi, " ").trim();
  }

  // Prefer "1 000" / "1.000" groups; plain digits last so "1000" ≠ "100"+"0"
  const amountMatch = working.match(
    /(\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)/,
  );
  let amount: number | null = null;
  if (amountMatch) {
    const normalized = amountMatch[1]
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".");
    const n = Number(normalized);
    if (Number.isFinite(n) && n >= 0) {
      amount = n;
      working = working.replace(amountMatch[0], " ").trim();
    }
  }

  // Strip common FR verbs / prepositions for person token
  working = working
    .replace(
      /^(verse[rz]?|effectuer?|paye[rz]?|paie[rz]?|envoie[rz]?|donne[rz]?)\s+/i,
      "",
    )
    .replace(/(?:^|\s)(à|a|pour|de)(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const personToken = working.length >= 2 ? working : null;

  let confidence = 0.35;
  if (personToken) confidence += 0.35;
  if (amount != null) confidence += 0.2;
  if (currency) confidence += 0.1;
  confidence = Math.min(1, confidence);

  return { raw, personToken, amount, currency, confidence };
}

export function formatMoneyTnd(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return "…";
  return `${amount.toLocaleString("fr-TN")} DT`;
}
