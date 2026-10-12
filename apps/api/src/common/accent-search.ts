const MAX_ACCENT_SCAN = 200;

export function foldSearchText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/**
 * Postgres `contains` + `mode: 'insensitive'` folds case but not accents, so a
 * typeahead where the user typed "societe" shows "Aucun résultat" while
 * "Société Elphir" exists. On a strict miss, re-read a bounded page without the
 * text filter and match folded text here; returns at most `limit` rows so the
 * caller's cursor logic is untouched. Skipped when the needle itself carries
 * diacritics (the SQL match already handles that case).
 */
export async function listWithAccentFallback<T>(args: {
  needle: string;
  limit: number;
  hasCursor: boolean;
  strict: () => Promise<T[]>;
  scanAll: (take: number) => Promise<T[]>;
  fields: (row: T) => Array<string | null | undefined>;
}): Promise<T[]> {
  const rows = await args.strict();
  if (!args.needle || rows.length > 0 || args.hasCursor) return rows;
  if (foldSearchText(args.needle) !== args.needle.toLowerCase()) return rows;

  const wide = await args.scanAll(MAX_ACCENT_SCAN + 1);
  if (wide.length > MAX_ACCENT_SCAN) return rows;
  const needle = foldSearchText(args.needle);
  return wide
    .filter((row) =>
      args
        .fields(row)
        .some((value) => value && foldSearchText(value).includes(needle)),
    )
    .slice(0, args.limit);
}
