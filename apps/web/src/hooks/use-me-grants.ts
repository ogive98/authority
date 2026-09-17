"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMeGrants } from "@/lib/me-grants";

/**
 * Effective session grants for ⌘K / dock filtering.
 * - `null` while loading/error → registry-trusted fallback
 * - `Set` after success (may be empty) → strict ACL snapshot
 */
export function useMeGrants() {
  const query = useQuery({
    queryKey: ["me-grants"],
    queryFn: fetchMeGrants,
    staleTime: 30_000,
  });

  const grants = useMemo(() => {
    if (!query.isSuccess || !query.data) return null;
    return new Set(query.data.grants);
  }, [query.isSuccess, query.data]);

  return {
    ...query,
    grants,
  };
}
