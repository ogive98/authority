import type { TenancyContext } from '../organization/organization.constants';

/** Adapter — FORGE reuses AUTHORITY tenancy, never a parallel tenant store. */
export type ForgeTenantContext = {
  companyId: string;
  siteId?: string;
  userId?: string;
  environment?: 'production' | 'sandbox';
};

export function toForgeTenantContext(
  tenancy: TenancyContext,
  userId?: string,
): ForgeTenantContext {
  return {
    companyId: tenancy.companyId,
    siteId: tenancy.siteId,
    userId,
    environment: 'production',
  };
}
