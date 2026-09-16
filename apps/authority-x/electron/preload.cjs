const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("authorityX", {
  getShortcutState: () => ipcRenderer.invoke("authority-x:get-shortcut-state"),
  setShortcutEnabled: (enabled) =>
    ipcRenderer.invoke("authority-x:set-shortcut-enabled", enabled),
  setCutSafe: (enabled) => ipcRenderer.invoke("authority-x:set-cut-safe", enabled),
  setShortcut: (accelerator) =>
    ipcRenderer.invoke("authority-x:set-shortcut", accelerator),
  hide: () => ipcRenderer.invoke("authority-x:hide"),
  show: () => ipcRenderer.invoke("authority-x:show"),
  connectionStub: () => ipcRenderer.invoke("authority-x:connection-stub"),
  getDeviceAuth: () => ipcRenderer.invoke("authority-x:get-device-auth"),
  setDeviceAuth: (auth) => ipcRenderer.invoke("authority-x:set-device-auth", auth),
  clearDeviceAuth: () => ipcRenderer.invoke("authority-x:clear-device-auth"),
  openAuthority: (url) => ipcRenderer.invoke("authority-x:open-authority", url),
  onOpened: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("authority-x:opened", handler);
    return () => ipcRenderer.removeListener("authority-x:opened", handler);
  },
  onClosed: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("authority-x:closed", handler);
    return () => ipcRenderer.removeListener("authority-x:closed", handler);
  },
  onShortcutState: (cb) => {
    const handler = (_e, state) => cb(state);
    ipcRenderer.on("authority-x:shortcut-state", handler);
    return () =>
      ipcRenderer.removeListener("authority-x:shortcut-state", handler);
  },
});
