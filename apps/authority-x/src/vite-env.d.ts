export type AuthorityXBridge = {
  getShortcutState: () => Promise<{
    shortcut: string;
    enabled: boolean;
    conflict?: boolean;
    lastConflict?: string | null;
    message?: string;
  }>;
  setShortcutEnabled: (enabled: boolean) => Promise<unknown>;
  setShortcut: (accelerator: string) => Promise<unknown>;
  hide: () => Promise<{ ok: boolean }>;
  show: () => Promise<{ ok: boolean }>;
  setInteractive: (
    interactive: boolean,
  ) => Promise<{ ok: boolean }>;
  isVisible: () => Promise<{ visible: boolean }>;
  connectionStub: () => Promise<{ state: string; note: string; paired?: boolean }>;
  getDeviceAuth: () => Promise<{
    token: string;
    deviceId: string;
    companyId: string;
    displayName: string;
    expiresAt: string;
  } | null>;
  setDeviceAuth: (auth: {
    token: string;
    deviceId: string;
    companyId: string;
    displayName: string;
    expiresAt: string;
  }) => Promise<{ ok: boolean }>;
  clearDeviceAuth: () => Promise<{ ok: boolean }>;
  openAuthority: (
    url?: string,
  ) => Promise<{ ok: boolean; url: string; error?: string }>;
  onOpened: (cb: () => void) => () => void;
  onClosed: (cb: () => void) => () => void;
  onShortcutState: (cb: (state: unknown) => void) => () => void;
};

declare global {
  interface Window {
    authorityX?: AuthorityXBridge;
  }
}

export {};
