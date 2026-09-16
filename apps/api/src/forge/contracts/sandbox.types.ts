/**
 * Future sandbox boundary — NO runtime in Phase 1.
 */

export type ForgeSandboxEnvironmentId = string;

export interface ForgeSandbox {
  createEnvironment(input: {
    extensionId: string;
    companyId: string;
  }): Promise<ForgeSandboxEnvironmentId>;

  destroyEnvironment(id: ForgeSandboxEnvironmentId): Promise<void>;

  /** Reserved — not implemented Phase 1. */
  build?(id: ForgeSandboxEnvironmentId): Promise<never>;
  test?(id: ForgeSandboxEnvironmentId): Promise<never>;
}
