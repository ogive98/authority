/** Session effective grants — `/api/v1/identity/me/grants` (D294 Track F+). */

export type MeGrantsResponse = {
  companyId: string | null;
  grants: string[];
};

const EMPTY: MeGrantsResponse = { companyId: null, grants: [] };

/**
 * Never throws — palette/dock fall back to registry-trusted when grants unavailable.
 */
export async function fetchMeGrants(): Promise<MeGrantsResponse> {
  try {
    const res = await fetch("/api/v1/identity/me/grants", {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as MeGrantsResponse;
    if (!Array.isArray(data.grants)) return EMPTY;
    return {
      companyId: data.companyId ?? null,
      grants: data.grants.filter((k) => typeof k === "string"),
    };
  } catch {
    return EMPTY;
  }
}
