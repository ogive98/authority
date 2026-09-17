/** UI extension contract — rendered via AUTHORITY D294 in Phase 2+. */

export type UiExtensionDefinition = {
  id: string;
  extensionId: string;
  kind: 'menu' | 'page' | 'widget' | 'drawer' | 'action';
  route?: string;
  label: Record<string, string>;
  permissionKey?: string;
  moduleKey?: string;
};
