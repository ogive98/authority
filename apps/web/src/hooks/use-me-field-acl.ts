"use client";

import { useQuery } from "@tanstack/react-query";
import {
  FALLBACK_FIELD_ACL,
  fetchMeFieldAcl,
  type MeFieldAcl,
} from "@/lib/field-acl";

export function useMeFieldAcl() {
  const query = useQuery<MeFieldAcl>({
    queryKey: ["me-field-acl"],
    queryFn: fetchMeFieldAcl,
    placeholderData: FALLBACK_FIELD_ACL,
    staleTime: 30_000,
  });

  return {
    ...query,
    data: query.data ?? FALLBACK_FIELD_ACL,
  };
}
