export const OPS_MODES_HEADER = "x-authority-ops-modes";

export type DeclaredOpsModes = {
  patch: boolean;
  ghost: boolean;
  spectre: boolean;
};

export function parseOpsModesHeader(
  raw?: string | string[] | null,
): DeclaredOpsModes {
  const s = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const set = new Set(
    s
      .split(/[\s,]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  );
  return {
    patch: set.has("patch"),
    ghost: set.has("ghost"),
    spectre: set.has("spectre"),
  };
}

export type PatchSampleMeta = {
  declared: true;
  applied: boolean;
  intensity: number;
  rules: string[];
  kept: number;
  total: number;
  note: string;
};

const SAMPLE_NOTE =
  "Display sample from client X-Authority-Ops-Modes: patch + Prefs intensity. Omit the header for the full page. Not an IAM filter.";

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Same ranking as web `filterEntriesByPatchRules` (D203/D208).
 * Keep algorithms in sync.
 */
export function sampleEntriesForPatch<
  T extends {
    id: string;
    entryDate?: string;
    lines?: { debit: string; credit: string }[];
  },
>(
  entries: T[],
  opts: { intensity: number; rules: string[] },
): { items: T[]; patchSample: PatchSampleMeta } {
  const intensity = Math.max(0, Math.min(100, Math.round(opts.intensity)));
  const rules = opts.rules.length ? opts.rules : ["by_date"];
  const total = entries.length;

  if (intensity >= 100) {
    return {
      items: entries,
      patchSample: {
        declared: true,
        applied: false,
        intensity,
        rules,
        kept: total,
        total,
        note: SAMPLE_NOTE,
      },
    };
  }

  if (intensity <= 0 || total === 0) {
    return {
      items: [],
      patchSample: {
        declared: true,
        applied: true,
        intensity,
        rules,
        kept: 0,
        total,
        note: SAMPLE_NOTE,
      },
    };
  }

  const amountOf = (e: T): number => {
    if (e.lines?.length) {
      return e.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    }
    return 0;
  };

  let ranked = [...entries];
  if (rules.includes("large_moves")) {
    ranked.sort((a, b) => amountOf(b) - amountOf(a));
  } else if (rules.includes("by_date")) {
    ranked.sort((a, b) =>
      String(b.entryDate ?? "").localeCompare(String(a.entryDate ?? "")),
    );
  }
  if (rules.includes("random")) {
    ranked = [...ranked].sort((a, b) => hashStr(a.id) - hashStr(b.id));
  }

  const keep = Math.max(1, Math.ceil((ranked.length * intensity) / 100));
  const items = ranked.slice(0, keep);
  return {
    items,
    patchSample: {
      declared: true,
      applied: true,
      intensity,
      rules,
      kept: items.length,
      total,
      note: SAMPLE_NOTE,
    },
  };
}
