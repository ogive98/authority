/**
 * AUTHORITY X — Electron main (Phase 2 Desktop Shell)
 * Default global shortcut: Control+X (configurable, disableable).
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
} = require("electron");
const path = require("path");
const http = require("http");

const isDev = !app.isPackaged;
const DEV_URL = "http://127.0.0.1:5173";
/** Loopback summon port — Soft Glass topbar POSTs here to open X */
const SUMMON_PORT = 17898;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
/** Guard — blur must not fight openExternal */
let openingAuthority = false;

const prefs = {
  /** Product default — do not replace with another combo as default. */
  shortcut: "CommandOrControl+X",
  shortcutEnabled: true,
  /** D-X1 — do not steal Cut when foreground is a text edit control */
  cutSafe: true,
  lastConflict: null,
  lastCutHold: null,
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
  });
}

function showOverlay() {
  if (!mainWindow) createWindow();
  if (!mainWindow) return;
  mainWindow.setBounds(getOverlayBounds());
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send("authority-x:opened");
}

function hideOverlay() {
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

function isForegroundTextEdit() {
  if (process.platform !== "win32") return false;
  try {
    const { execFileSync } = require("child_process");
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class AxFg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
}
"@
$hwnd = [AxFg]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[void][AxFg]::GetClassName($hwnd, $sb, 256)
Write-Output $sb.ToString()
`;
    const cls = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf8", timeout: 900, windowsHide: true },
    )
      .trim()
      .split(/\r?\n/)
      .pop();
    if (!cls) return false;
    // Classic Win32 edit surfaces where Cut (CTRL+X) must win
    return /Edit|RichEdit|Scintilla|Notepad|TextBox|Chrome_RenderWidgetHostHWND/i.test(
      cls,
    );
  } catch {
    return false;
  }
}

function registerShortcut() {
  unregisterShortcut();
  if (!prefs.shortcutEnabled) {
    return { ok: true, enabled: false, shortcut: prefs.shortcut, cutSafe: prefs.cutSafe };
  }

  const ok = globalShortcut.register(prefs.shortcut, () => {
    if (prefs.cutSafe && isForegroundTextEdit()) {
      prefs.lastCutHold = new Date().toISOString();
      return;
    }
    toggleOverlay();
  });

  if (!ok) {
    prefs.lastConflict = prefs.shortcut;
    return {
      ok: false,
      enabled: true,
      shortcut: prefs.shortcut,
      cutSafe: prefs.cutSafe,
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
    cutSafe: prefs.cutSafe,
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
    {
      label: prefs.cutSafe
        ? "Anti-Cut: ON (Edit = Couper)"
        : "Anti-Cut: OFF",
      click: () => {
        prefs.cutSafe = !prefs.cutSafe;
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
 * Soft Glass topbar → fetch http://127.0.0.1:17898/open
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
  const result = registerShortcut();
  // Start hidden in tray
  hideOverlay();

  ipcMain.handle("authority-x:get-shortcut-state", () => ({
    shortcut: prefs.shortcut,
    enabled: prefs.shortcutEnabled,
    cutSafe: prefs.cutSafe,
    conflict: Boolean(prefs.lastConflict),
    lastConflict: prefs.lastConflict,
    lastCutHold: prefs.lastCutHold,
    result,
  }));

  ipcMain.handle("authority-x:set-shortcut-enabled", (_e, enabled) => {
    prefs.shortcutEnabled = Boolean(enabled);
    const next = registerShortcut();
    tray?.setContextMenu(buildTrayMenu());
    return next;
  });

  ipcMain.handle("authority-x:set-cut-safe", (_e, enabled) => {
    prefs.cutSafe = Boolean(enabled);
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

  ipcMain.handle("authority-x:show", () => {
    showOverlay();
    return { ok: true };
  });

  ipcMain.handle("authority-x:connection-stub", () => ({
    state: "Connected",
    note: "Phase 2 shell — auth/device pairing Phase 4+",
  }));

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
