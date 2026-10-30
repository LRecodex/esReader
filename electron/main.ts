import { app, BrowserWindow, ipcMain, shell, screen } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerAutoUpdater } from './updater.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const API_ORIGIN = 'https://estory.fauzulazim.com';
let win: BrowserWindow | null = null;
let sessionCookie = '';

function savedWindowBounds(): { width: number; height: number; x?: number; y?: number } {
  const fallback = { width: 410, height: 900 };
  try {
    const value = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'window.json'), 'utf8'));
    if (!Number.isFinite(value.width) || !Number.isFinite(value.height)) return fallback;
    const width = Math.max(320, Math.min(1800, Math.round(value.width)));
    const height = Math.max(420, Math.min(1400, Math.round(value.height)));
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return { width, height };
    const display = screen.getDisplayMatching({ x: value.x, y: value.y, width, height });
    const area = display.workArea;
    return { width: Math.min(width, area.width), height: Math.min(height, area.height), x: Math.max(area.x, Math.min(Math.round(value.x), area.x + area.width - Math.min(width, area.width))), y: Math.max(area.y, Math.min(Math.round(value.y), area.y + area.height - Math.min(height, area.height))) };
  } catch { return fallback; }
}

function trusted(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? '';
  if (process.env.VITE_DEV_SERVER_URL) {
    try { return new URL(url).origin === new URL(process.env.VITE_DEV_SERVER_URL).origin; } catch { return false; }
  }
  return url === pathToFileURL(path.join(here, '../dist/index.html')).href;
}

function createWindow() {
  const bounds = savedWindowBounds();
  win = new BrowserWindow({
    ...bounds,
    minWidth: 320,
    minHeight: 420,
    backgroundColor: '#1e1e1e',
    icon: path.join(here, '../assets/esreader-icon.ico'),
    title: 'esReader',
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(here, '../electron/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win?.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://estory.fauzulazim.com/')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const trustedUrl = process.env.VITE_DEV_SERVER_URL ?? 'file://';
    if (!url.startsWith(trustedUrl)) event.preventDefault();
  });
  win.on('close', () => {
    if (!win || win.isMinimized()) return;
    const { x, y, width, height } = win.getBounds();
    try { fs.writeFileSync(path.join(app.getPath('userData'), 'window.json'), JSON.stringify({ x, y, width, height })); } catch { /* Window state is optional. */ }
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(here, '../dist/index.html'));
}

ipcMain.handle('auth:login', async (_event, credentials: unknown) => {
  if (!trusted(_event)) throw new Error('Untrusted application request.');
  if (!credentials || typeof credentials !== 'object') throw new Error('Enter your esTory sign-in details.');
  const { email, password } = credentials as { email?: unknown; password?: unknown };
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) throw new Error('Enter your email and password.');
  const response = await fetch(`${API_ORIGIN}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) });
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
  if (!response.ok) throw new Error(body?.error || `Sign in failed (${response.status}).`);
  const cookie = response.headers.get('set-cookie')?.match(/cerita_session=([^;]+)/)?.[1];
  if (!cookie) throw new Error('esTory did not create a reader session.');
  sessionCookie = `cerita_session=${cookie}`;
  return body;
});

ipcMain.handle('auth:session', async (event) => {
  if (!trusted(event)) throw new Error('Untrusted application request.');
  if (!sessionCookie) return null;
  const response = await fetch(`${API_ORIGIN}/api/auth/me`, { headers: { Cookie: sessionCookie, Accept: 'application/json' } });
  if (!response.ok) { sessionCookie = ''; return null; }
  return response.json();
});
ipcMain.handle('auth:logout', async (event) => {
  if (!trusted(event)) throw new Error('Untrusted application request.');
  if (sessionCookie) await fetch(`${API_ORIGIN}/api/auth/logout`, { method: 'POST', headers: { Cookie: sessionCookie, Origin: API_ORIGIN, Accept: 'application/json' } }).catch(() => {});
  sessionCookie = '';
});

ipcMain.handle('reader:request', async (_event, pathValue: unknown, options?: { method?: unknown; body?: unknown }) => {
  if (!trusted(_event)) throw new Error('Untrusted application request.');
  if (typeof pathValue !== 'string' || !/^\/api\/(?:reader\/stories(?:\/|\?|$)|stories\/[^/]+\/cover(?:\?|$))/.test(pathValue)) {
    throw new Error('Only published reader requests are available.');
  }
  const method = options?.method ?? 'GET';
  if (!['GET', 'PUT', 'POST', 'DELETE'].includes(String(method))) throw new Error('Unsupported reader request.');
  const route = pathValue.split('?')[0];
  const collectionRoute = route === '/api/reader/stories';
  const storyRoute = /^\/api\/reader\/stories\/[^/]+(?:\/chapters\/[^/]+)?$/.test(route);
  const progressRoute = /^\/api\/reader\/stories\/[^/]+\/progress$/.test(route);
  const bookmarksRoute = /^\/api\/reader\/stories\/[^/]+\/bookmarks(?:\/[^/]+)?$/.test(route);
  const coverRoute = /^\/api\/stories\/[^/]+\/cover$/.test(route);
  const methodAllowed = (collectionRoute || storyRoute || coverRoute) ? method === 'GET'
    : progressRoute ? ['GET', 'PUT'].includes(String(method))
    : bookmarksRoute ? (route.endsWith('/bookmarks') ? ['GET', 'POST'].includes(String(method)) : method === 'DELETE')
    : false;
  if (!methodAllowed) throw new Error('This reader action is not available.');
  if (!sessionCookie) throw new Error('Sign in to your esTory account to open your reading room.');
  const url = new URL(pathValue, API_ORIGIN);
  if (url.origin !== API_ORIGIN) throw new Error('Invalid reader request.');
  const response = await fetch(url, {
    method: String(method),
    headers: { Accept: 'application/json', Cookie: sessionCookie, ...(method !== 'GET' ? { Origin: API_ORIGIN } : {}), ...(options?.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    const body = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
    throw new Error(body?.error || `Reader request failed (${response.status}).`);
  }
  if (contentType.startsWith('image/')) {
    return { kind: 'image', contentType, data: Buffer.from(await response.arrayBuffer()).toString('base64') };
  }
  return { kind: 'json', data: await response.json() };
});

app.whenReady().then(() => {
  registerAutoUpdater();
ipcMain.handle('app:version', (event) => { if (!trusted(event)) throw new Error('Untrusted application request.'); return app.getVersion(); });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.on('window:action', (event, action: unknown) => {
  if (!trusted(event)) return;
  const target = BrowserWindow.fromWebContents(event.sender);
  if (!target || typeof action !== 'string') return;
  if (action === 'minimize') target.minimize();
  if (action === 'toggle-maximize') target.isMaximized() ? target.unmaximize() : target.maximize();
  if (action === 'close') target.close();
});
ipcMain.on('external:open', (_event, url: unknown) => {
  if (!trusted(_event)) return;
  if (url === 'https://estory.fauzulazim.com/') void shell.openExternal(url);
});
