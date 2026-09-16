/**
 * Future AI boundary — NO implementation in Phase 1.
 * No autonomous agent · no repo access · no codegen loop.
 */

export type ForgeAiAnalysisResult = {
  summary: string;
  affectedModules: string[];
  coreChangeRequired: boolean;
  suggestedApproach: 'config' | 'metadata' | 'extension' | 'core';
};

export interface ForgeAIProvider {
  analyzeRequirement(input: {
    title: string;
    description: string;
    tenantId: string;
  }): Promise<ForgeAiAnalysisResult>;

  /** Reserved — throws / UNAVAILABLE in Phase 1. */
  planFeature?(): Promise<never>;
  generateExtension?(): Promise<never>;
}
