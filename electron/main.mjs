import { app, BrowserWindow, ipcMain, net, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL;

/**
 * Where the desktop app looks for a live ensemble backend. Overridable so the
 * app is not welded to one machine's setup.
 */
const BACKEND_URL = (process.env.NODE_DRIVER_BACKEND ?? 'http://127.0.0.1:3001').replace(/\/$/, '');

/** Only these paths may be relayed — the bridge is not a general web proxy. */
const ALLOWED_PATH = /^\/api\/(ensemble|driver)\//;

/** @type {BrowserWindow | null} */
let mainWindow = null;

/**
 * Relay a backend request from the renderer.
 *
 * The renderer is sandboxed and file:// origin, so it cannot reach the backend
 * itself. Requests are restricted to the configured origin and the ensemble and
 * driver API paths, so a compromised renderer cannot turn this into an open
 * proxy onto the user's machine or network.
 */
function registerBackendBridge() {
  ipcMain.handle('backend:url', () => BACKEND_URL);

  ipcMain.handle('backend:request', async (_event, options) => {
    const { path: reqPath, method = 'GET', body = null, token = null } = options ?? {};

    if (typeof reqPath !== 'string' || !ALLOWED_PATH.test(reqPath)) {
      return { ok: false, status: 0, body: '', error: `refused path: ${String(reqPath)}` };
    }
    if (method !== 'GET' && method !== 'POST') {
      return { ok: false, status: 0, body: '', error: `refused method: ${String(method)}` };
    }

    const headers = { Accept: 'application/json' };
    if (body != null) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const response = await net.fetch(`${BACKEND_URL}${reqPath}`, {
        method,
        headers,
        ...(body != null ? { body } : {}),
      });
      return { ok: response.ok, status: response.status, body: await response.text() };
    } catch (cause) {
      return { ok: false, status: 0, body: '', error: cause?.message ?? String(cause) };
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: '#0a0a0b',
    title: 'Node Driver',
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset',
          trafficLightPosition: { x: 14, y: 14 },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerBackendBridge();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
