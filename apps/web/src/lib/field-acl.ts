export const FIELD_ACL_WAGE_KEY = "hr.wage";
export const FIELD_ACL_WAGE_PERMISSION = "hr.wage.read";

export type FieldAclEntry = {
  key: string;
  permissionKey: string;
  visible: boolean;
};

export type MeFieldAcl = {
  companyId: string | null;
  fields: FieldAclEntry[];
};

/** Fail-closed when Nest is down / unauthenticated — never leak wage. */
export const FALLBACK_FIELD_ACL: MeFieldAcl = {
  companyId: null,
  fields: [
    {
      key: FIELD_ACL_WAGE_KEY,
      permissionKey: FIELD_ACL_WAGE_PERMISSION,
      visible: false,
    },
  ],
};

/** Visible only if the field is present and explicitly true. */
export function isFieldVisible(
  acl: MeFieldAcl | undefined,
  fieldKey: string,
): boolean {
  if (!acl) return false;
  return acl.fields.some((f) => f.key === fieldKey && f.visible === true);
}

const FIELD_ACL_TIMEOUT_MS = 4_000;

export async function fetchMeFieldAcl(): Promise<MeFieldAcl> {
  try {
    const res = await fetch("/api/v1/me/field-acl", {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FIELD_ACL_TIMEOUT_MS),
    });
    if (!res.ok) {
      return FALLBACK_FIELD_ACL;
    }
    const data = (await res.json()) as MeFieldAcl;
    if (!Array.isArray(data.fields)) {
      return FALLBACK_FIELD_ACL;
    }
    return data;
  } catch {
    return FALLBACK_FIELD_ACL;
  }
}
