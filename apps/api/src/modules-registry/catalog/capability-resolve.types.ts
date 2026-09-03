export interface CapabilityResolveContext {
  companyId: string;
  userId?: string;
  siteId?: string;
}

export type CapabilityResolveResult =
  | {
      allowed: true;
      capabilityKey: string;
      moduleId: string;
    }
  | {
      allowed: false;
      code: string;
      message: string;
      capabilityKey: string;
      moduleId?: string;
    };
