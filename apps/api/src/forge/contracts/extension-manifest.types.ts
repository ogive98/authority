/**
 * FORGE extension manifest contract (Phase 1 — declarative only).
 * Stored in FrgExtension.manifestJson; not an executable plugin bundle.
 */

export type ExtensionTenantScope = 'company' | 'site';

export type ExtensionManifestPermission = {
  key: string;
  description?: string;
};

export type ExtensionManifestCapability = {
  key: string;
  description?: string;
  permissionKey?: string;
};

export type ExtensionManifestEvent = {
  type: string;
  description?: string;
};

export type ExtensionUiContribution = {
  kind: 'menu' | 'page' | 'widget' | 'action' | 'column' | 'field';
  id: string;
  route?: string;
  label?: Record<string, string>;
};

/** JSON-serializable manifest body (indexed columns mirror key fields). */
export type ExtensionManifestBody = {
  key: string;
  name: string;
  description?: string;
  version: string;
  tenantScope?: ExtensionTenantScope;
  author?: string;
  dependencies?: string[];
  compatibleCoreVersion?: string;
  permissions?: ExtensionManifestPermission[];
  capabilities?: ExtensionManifestCapability[];
  publishedEvents?: ExtensionManifestEvent[];
  consumedEvents?: ExtensionManifestEvent[];
  ui?: ExtensionUiContribution[];
  configurationSchema?: Record<string, unknown>;
};
