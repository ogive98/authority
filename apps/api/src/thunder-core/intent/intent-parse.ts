export type IntentCurrency = 'TND';

export type IntentParsed = {
  raw: string;
  personToken: string | null;
  amount: number | null;
  currency: IntentCurrency | null;
  confidence: number;
};

/**
 * Deterministic FR/TN parse — mirrors AUTHORITY X local engine.
 * Thunder re-parses for trust; does not invent business meaning.
 */
export function parseIntentCommand(rawInput: string): IntentParsed {
  const raw = rawInput.trim().replace(/\s+/g, ' ');
  if (!raw) {
    return {
      raw: '',
      personToken: null,
      amount: null,
      currency: null,
      confidence: 0,
    };
  }

  let currency: IntentCurrency | null = null;
  let working = raw;

  if (/\b(dt|tnd|dinars?)\b/i.test(working)) {
    currency = 'TND';
    working = working.replace(/\b(dt|tnd|dinars?)\b/gi, ' ').trim();
  }

  const amountMatch = working.match(
    /(\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)/,
  );
  let amount: number | null = null;
  if (amountMatch) {
    const normalized = amountMatch[1]
      .replace(/\s/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    const n = Number(normalized);
    if (Number.isFinite(n) && n >= 0) {
      amount = n;
      working = working.replace(amountMatch[0], ' ').trim();
    }
  }

  working = working
    .replace(
      /^(verse[rz]?|effectuer?|paye[rz]?|paie[rz]?|envoie[rz]?|donne[rz]?)\s+/i,
      '',
    )
    .replace(/(?:^|\s)(à|a|pour|de)(?=\s|$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const personToken = working.length >= 2 ? working : null;

  let confidence = 0.35;
  if (personToken) confidence += 0.35;
  if (amount != null) confidence += 0.2;
  if (currency) confidence += 0.1;

  return {
    raw,
    personToken,
    amount,
    currency,
    confidence: Math.min(1, confidence),
  };
}
