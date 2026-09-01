export const TENANCY_HEADERS = {
  companyId: 'x-authority-company-id',
  siteId: 'x-authority-site-id',
} as const;

export const TENANCY_COOKIES = {
  companyId: 'authority_company_id',
  siteId: 'authority_site_id',
} as const;

export const ORG_ERROR_CODES = {
  CONTEXT_FORBIDDEN: 'ORG.CONTEXT_FORBIDDEN',
  COMPANY_NOT_FOUND: 'ORG.COMPANY_NOT_FOUND',
  SITE_NOT_FOUND: 'ORG.SITE_NOT_FOUND',
} as const;

export type OrgErrorCode =
  (typeof ORG_ERROR_CODES)[keyof typeof ORG_ERROR_CODES];

export interface TenancyContext {
  companyId: string;
  siteId?: string;
}
