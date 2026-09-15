import type { EntityKind, ResolvedEntity } from "./types";

/** Local mock directory — replaced by API entity resolve in Phase 4+ */
const MOCK_ENTITIES: ResolvedEntity[] = [
  {
    id: "sup-ahmed-benali",
    kind: "supplier",
    label: "Ahmed Ben Ali",
    aliases: ["ahmed", "ahmed ben ali", "ben ali"],
  },
  {
    id: "cus-ahmed-trabelsi",
    kind: "customer",
    label: "Ahmed Trabelsi",
    aliases: ["ahmed", "ahmed trabelsi", "trabelsi"],
  },
  {
    id: "emp-ahmed-mansour",
    kind: "employee",
    label: "Ahmed Mansour",
    aliases: ["ahmed", "ahmed mansour", "mansour"],
  },
  {
    id: "sup-mohamed",
    kind: "supplier",
    label: "Mohamed Saïdi",
    aliases: ["mohamed", "mohamed saidi", "saidi", "saïdi"],
  },
  {
    id: "cus-abc",
    kind: "customer",
    label: "ABC Fromagerie",
    aliases: ["abc", "abc fromagerie"],
  },
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

export function resolveEntities(personToken: string | null): ResolvedEntity[] {
  if (!personToken) return [];
  const q = norm(personToken);
  if (q.length < 2) return [];

  const scored = MOCK_ENTITIES.map((e) => {
    const hay = [e.label, ...e.aliases].map(norm);
    let score = 0;
    for (const h of hay) {
      if (h === q) score = Math.max(score, 100);
      else if (h.startsWith(q) || q.startsWith(h)) score = Math.max(score, 80);
      else if (h.includes(q) || q.includes(h)) score = Math.max(score, 55);
    }
    return { e, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // Ambiguity: if top is exact single, return it; if several high scores, return all
  if (scored.length === 0) return [];
  const top = scored[0].score;
  const near = scored.filter((x) => x.score >= Math.min(top, 80));
  // Never silent-pick when several entities match the same token
  if (near.length > 1) return near.map((x) => x.e);
  return [scored[0].e];
}

export function entityKindLabel(kind: EntityKind): string {
  switch (kind) {
    case "supplier":
      return "Fournisseur";
    case "customer":
      return "Client";
    case "employee":
      return "Employé";
    default:
      return "Contact";
  }
}
