import type { FrgFeatureRequestStatus } from '@prisma/client';

/** Intake payload — no auto-implementation in Phase 1. */
export type FeatureRequestSource = 'manual' | 'support' | 'import';

export type CreateFeatureRequestInput = {
  title: string;
  description?: string;
  priority?: number;
  source?: FeatureRequestSource;
  affectedModules?: string[];
  extensionId?: string;
};

export type FeatureRequestDto = {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  status: FrgFeatureRequestStatus;
  priority: number;
  source: string;
  requestedByUserId: string | null;
  affectedModules: string[];
  extensionId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};
