import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAutoUpdater } from './updater.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const API_ORIGIN = 'https://estory.fauzulazim.com';
let win: BrowserWindow | null = null;
let sessionCookie = '';

function createWindow() {
  win = new BrowserWindow({
    width: 410,
    height: 900,
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
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(here, '../dist/index.html'));
}

ipcMain.handle('auth:login', async (_event, credentials: unknown) => {
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

ipcMain.handle('auth:session', async () => {
  if (!sessionCookie) return null;
  const response = await fetch(`${API_ORIGIN}/api/auth/me`, { headers: { Cookie: sessionCookie, Accept: 'application/json' } });
  if (!response.ok) { sessionCookie = ''; return null; }
  return response.json();
});
ipcMain.handle('auth:logout', async () => {
  if (sessionCookie) await fetch(`${API_ORIGIN}/api/auth/logout`, { method: 'POST', headers: { Cookie: sessionCookie, Origin: API_ORIGIN, Accept: 'application/json' } }).catch(() => {});
  sessionCookie = '';
});

ipcMain.handle('reader:request', async (_event, pathValue: unknown) => {
  if (typeof pathValue !== 'string' || !/^\/api\/(?:reader\/stories(?:\/|\?|$)|stories\/[^/]+\/cover(?:\?|$))/.test(pathValue)) {
    throw new Error('Only published reader requests are available.');
  }
  if (!sessionCookie) throw new Error('Sign in to your esTory account to open your reading room.');
  const url = new URL(pathValue, API_ORIGIN);
  if (url.origin !== API_ORIGIN) throw new Error('Invalid reader request.');
  const response = await fetch(url, { headers: { Accept: 'application/json', Cookie: sessionCookie } });
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
  ipcMain.handle('app:version', () => app.getVersion());
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.on('window:action', (event, action: unknown) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  if (!target || typeof action !== 'string') return;
  if (action === 'minimize') target.minimize();
  if (action === 'toggle-maximize') target.isMaximized() ? target.unmaximize() : target.maximize();
  if (action === 'close') target.close();
});
ipcMain.on('external:open', (_event, url: unknown) => {
  if (url === 'https://estory.fauzulazim.com/') void shell.openExternal(url);
});
