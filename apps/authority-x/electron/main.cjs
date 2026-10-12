/**
 * AUTHORITY X — Electron main (Phase 2 Desktop Shell)
 * Default global shortcut: Control+Alt+X (configurable, disableable).
 * Never a plain editing combo: a system-wide hotkey shadows Cut in every app.
 * Never invent ERP workflows here — companion shell only.
 */
const {
  app,
  BrowserWindow,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
  safeStorage,
} = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

const isDev = !app.isPackaged;
const DEV_URL = "http://127.0.0.1:5173";
/** Loopback summon port — AUTHORITY topbar POSTs here to open X */
const SUMMON_PORT = 17898;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
/** Guard — blur must not fight openExternal */
let openingAuthority = false;

/** Renderer has an editable surface on screen → may hold OS focus. */
let overlayInteractive = false;

const prefs = {
  /** Editing-free default: Ctrl+X would swallow Cut in every other app. */
  shortcut: "CommandOrControl+Alt+X",
  shortcutEnabled: true,
  lastConflict: null,
};

function createTrayIcon() {
  // 16x16 teal-ish X on transparent — simple PNG buffer via data URL canvas substitute
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const onDiag =
        Math.abs(x - y) <= 1 || Math.abs(x + y - (size - 1)) <= 1;
      const inPad = x > 2 && x < 13 && y > 2 && y < 13;
      if (onDiag && inPad) {
        canvas[i] = 45;
        canvas[i + 1] = 212;
        canvas[i + 2] = 191;
        canvas[i + 3] = 255;
      } else {
        canvas[i + 3] = 0;
      }
    }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

function deviceAuthPath() {
  return path.join(app.getPath("userData"), "authority-x-device.bin");
}

function readDeviceAuth() {
  try {
    const buf = fs.readFileSync(deviceAuthPath());
    const raw = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString("utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.token !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDeviceAuth(auth) {
  const json = JSON.stringify({
    token: auth.token,
    deviceId: auth.deviceId,
    companyId: auth.companyId,
    displayName: auth.displayName,
    expiresAt: auth.expiresAt,
  });
  const payload = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, "utf8");
  fs.writeFileSync(deviceAuthPath(), payload);
}

function clearDeviceAuthFile() {
  try {
    fs.unlinkSync(deviceAuthPath());
  } catch {
    /* missing is fine */
  }
}

function getOverlayBounds() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { width, height, x, y } = display.workArea;
  const w = 460;
  const h = 620;
  const margin = 24;
  return {
    width: w,
    height: h,
    x: Math.round(x + width - w - margin),
    y: Math.round(y + height - h - margin),
  };
}

function createWindow() {
  const bounds = getOverlayBounds();
  mainWindow = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("blur", () => {
    if (openingAuthority) return;
    if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      hideOverlay();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    overlayInteractive = false;
  });
}

/**
 * Single source of truth for "may this window eat OS input?".
 * Non-interactive = click-through AND keyboard-through: a focusable,
 * always-on-top, click-through window is the trap that makes typing die
 * everywhere (clicks forward to the page below, keystrokes stay here).
 */
function applyInteractivity(interactive) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  overlayInteractive = interactive;
  mainWindow.setIgnoreMouseEvents(!interactive, { forward: !interactive });
  if (mainWindow.isFocusable() !== interactive) {
    mainWindow.setFocusable(interactive);
  }
  if (interactive) {
    if (prefs.shortcutEnabled) unregisterShortcut();
    mainWindow.focus();
  } else {
    if (mainWindow.isFocused()) mainWindow.blur();
    // X gave up the keyboard → the global summon answers again.
    if (prefs.shortcutEnabled) registerShortcut();
  }
}

function showOverlay() {
  if (!mainWindow) createWindow();
  if (!mainWindow) return;
  // Summon = intent to type into X.
  mainWindow.setBounds(getOverlayBounds());
  applyInteractivity(true);
  // Top-most panel rank: a plain alwaysOnTop window summoned from a loopback
  // request never wins activation, so X showed up but stayed deaf to keys.
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  app.focus({ steal: true });
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("authority-x:opened");
}

function hideOverlay() {
  if (mainWindow && !mainWindow.isDestroyed()) applyInteractivity(false);
  if (mainWindow && mainWindow.isVisible()) {
    mainWindow.hide();
    mainWindow.webContents.send("authority-x:closed");
  }
}

function toggleOverlay() {
  if (mainWindow && mainWindow.isVisible()) {
    hideOverlay();
  } else {
    showOverlay();
  }
}

function unregisterShortcut() {
  globalShortcut.unregisterAll();
  prefs.lastConflict = null;
}

/**
 * A system-wide hotkey is consumed before the target app ever sees the key,
 * so X must never register an editing combo (Cut/Copy/Paste/Undo/Select-all):
 * that is how the shell silently kills typing in every other window.
 */
const FORBIDDEN_SHORTCUTS = new Set([
  "commandorcontrol+x",
  "commandorcontrol+c",
  "commandorcontrol+v",
  "commandorcontrol+z",
  "commandorcontrol+a",
  "commandorcontrol+f",
  "control+x",
  "control+c",
  "control+v",
  "control+z",
  "control+a",
  "alt+space",
]);

function isForbiddenShortcut(accelerator) {
  return FORBIDDEN_SHORTCUTS.has(accelerator.toLowerCase().replace(/\s+/g, ""));
}

function shortcutState() {
  return {
    shortcut: prefs.shortcut,
    enabled: prefs.shortcutEnabled,
    conflict: Boolean(prefs.lastConflict),
    lastConflict: prefs.lastConflict,
  };
}

function registerShortcut() {
  unregisterShortcut();
  if (!prefs.shortcutEnabled) {
    return { ok: true, enabled: false, shortcut: prefs.shortcut };
  }

  if (isForbiddenShortcut(prefs.shortcut)) {
    prefs.lastConflict = prefs.shortcut;
    return {
      ok: false,
      enabled: true,
      shortcut: prefs.shortcut,
      conflict: true,
      message:
        "Raccourci refusé : Couper/Coller/Sélection restent à l'édition. Choisissez Alt ou Maj dans la combinaison.",
    };
  }

  const ok = globalShortcut.register(prefs.shortcut, () => toggleOverlay());

  if (!ok) {
    prefs.lastConflict = prefs.shortcut;
    return {
      ok: false,
      enabled: true,
      shortcut: prefs.shortcut,
      conflict: true,
      message:
        "Raccourci global indisponible (conflit OS/autre app). Désactivez ou changez via le tray.",
    };
  }

  prefs.lastConflict = null;
  return {
    ok: true,
    enabled: true,
    shortcut: prefs.shortcut,
    conflict: false,
  };
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: "Ouvrir AUTHORITY X",
      click: () => showOverlay(),
    },
    {
      label: prefs.shortcutEnabled
        ? `Raccourci: ${prefs.shortcut}`
        : "Raccourci: désactivé",
      enabled: false,
    },
    { type: "separator" },
    {
      label: prefs.shortcutEnabled
        ? "Désactiver raccourci global"
        : "Activer raccourci global",
      click: () => {
        prefs.shortcutEnabled = !prefs.shortcutEnabled;
        const result = registerShortcut();
        if (mainWindow) {
          mainWindow.webContents.send("authority-x:shortcut-state", result);
        }
        tray?.setContextMenu(buildTrayMenu());
      },
    },
    { type: "separator" },
    {
      label: "Quitter",
      click: () => {
        unregisterShortcut();
        app.quit();
      },
    },
  ]);
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("AUTHORITY X");
  tray.setContextMenu(buildTrayMenu());
  tray.on("click", () => toggleOverlay());
}

/**
 * AUTHORITY topbar → fetch http://127.0.0.1:17898/open
 * Brings AUTHORITY X to front (AUTHORITY stays open in background).
 */
function startSummonServer() {
  const server = http.createServer((req, res) => {
    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || "/";
    if (
      (req.method === "GET" || req.method === "POST") &&
      (url === "/open" || url.startsWith("/open?"))
    ) {
      showOverlay();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, app: "authority-x" }));
      return;
    }

    if (url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false }));
  });

  server.on("error", (err) => {
    console.warn("[authority-x] summon server:", err.message);
  });

  server.listen(SUMMON_PORT, "127.0.0.1", () => {
    console.log(`[authority-x] summon http://127.0.0.1:${SUMMON_PORT}/open`);
  });

  return server;
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  startSummonServer();
  // Start hidden in tray — this also releases OS input and arms the summon.
  hideOverlay();
  console.log(
    `[authority-x] summon ${prefs.shortcut} · enabled=${prefs.shortcutEnabled} · conflict=${Boolean(
      prefs.lastConflict,
    )}`,
  );

  ipcMain.handle("authority-x:get-shortcut-state", () => shortcutState());

  ipcMain.handle("authority-x:set-shortcut-enabled", (_e, enabled) => {
    prefs.shortcutEnabled = Boolean(enabled);
    const next = registerShortcut();
    tray?.setContextMenu(buildTrayMenu());
    return next;
  });

  ipcMain.handle("authority-x:set-shortcut", (_e, accelerator) => {
    if (typeof accelerator === "string" && accelerator.trim()) {
      prefs.shortcut = accelerator.trim();
    }
    const next = registerShortcut();
    tray?.setContextMenu(buildTrayMenu());
    return next;
  });

  ipcMain.handle("authority-x:hide", () => {
    hideOverlay();
    return { ok: true };
  });

  // Renderer idle (orb only) → pass mouse AND keyboard through, so the
  // overlay can never hold OS focus without an editable surface.
  // Expanded → interactive, and the global summon yields to X's own input.
  ipcMain.handle("authority-x:set-interactive", (_e, interactive) => {
    applyInteractivity(Boolean(interactive));
    return { ok: true };
  });

  // Renderer pulls visibility on mount: covers the race where showOverlay()
  // fires "opened" before the page (vite first load) has registered it.
  ipcMain.handle("authority-x:is-visible", () => ({
    visible: Boolean(mainWindow && mainWindow.isVisible()),
  }));

  ipcMain.handle("authority-x:show", () => {
    showOverlay();
    return { ok: true };
  });

  ipcMain.handle("authority-x:connection-stub", () => {
    const auth = readDeviceAuth();
    return {
      state: auth ? "Paired" : "Local",
      paired: Boolean(auth),
      note: auth
        ? "Device token in OS keyring — Thunder prepare uses Bearer."
        : "Unpaired — paste AUTHORITY Poste code (D274).",
    };
  });

  ipcMain.handle("authority-x:get-device-auth", () => readDeviceAuth());

  ipcMain.handle("authority-x:set-device-auth", (_e, auth) => {
    if (!auth || typeof auth.token !== "string") {
      return { ok: false };
    }
    writeDeviceAuth(auth);
    return { ok: true };
  });

  ipcMain.handle("authority-x:clear-device-auth", () => {
    clearDeviceAuthFile();
    return { ok: true };
  });

  ipcMain.handle("authority-x:open-authority", async (_e, url) => {
    const { shell } = require("electron");
    const target =
      typeof url === "string" && url.trim()
        ? url.trim()
        : "http://127.0.0.1:3000";
    openingAuthority = true;
    try {
      if (mainWindow) {
        mainWindow.setAlwaysOnTop(false);
      }
      hideOverlay();
      await shell.openExternal(target);
      return { ok: true, url: target };
    } catch (err) {
      return {
        ok: false,
        url: target,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      setTimeout(() => {
        openingAuthority = false;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(true);
        }
      }, 800);
    }
  });
});

app.on("will-quit", () => {
  unregisterShortcut();
});

app.on("window-all-closed", (e) => {
  // Stay in tray on Windows
  e.preventDefault();
});
