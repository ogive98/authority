import type { FrgMetadataStatus, FrgMetadataType } from '@prisma/client';

/** Complements ModuleManifest + web command-catalog — does not replace them. */
export type MetadataDefinitionInput = {
  key: string;
  type: FrgMetadataType;
  moduleKey: string;
  extensionId?: string;
  schemaJson?: Record<string, unknown>;
};

export type MetadataDefinitionDto = {
  id: string;
  companyId: string;
  key: string;
  type: FrgMetadataType;
  moduleKey: string;
  extensionId: string | null;
  schemaJson: Record<string, unknown>;
  status: FrgMetadataStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};
