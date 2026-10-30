import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';

export type UpdateStatus = {
  status: 'unsupported' | 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  currentVersion: string;
  availableVersion?: string;
  message?: string;
  percent?: number;
};

let status: UpdateStatus = { status: 'idle', currentVersion: app.getVersion() };
let checkTimer: NodeJS.Timeout | undefined;
let initialCheck: NodeJS.Timeout | undefined;

function publish(next: UpdateStatus): void {
  status = next;
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send('update:status', status);
}

export function registerAutoUpdater(): void {
  ipcMain.handle('update:getStatus', () => status);
  const check = async (): Promise<UpdateStatus> => {
    if (!app.isPackaged) {
      publish({ status: 'unsupported', currentVersion: app.getVersion(), message: 'Updates are available in installed builds.' });
      return status;
    }
    if (['checking', 'downloading', 'downloaded'].includes(status.status)) return status;
    publish({ status: 'checking', currentVersion: app.getVersion() });
    try { await autoUpdater.checkForUpdates(); }
    catch (error) { publish({ status: 'error', currentVersion: app.getVersion(), message: error instanceof Error ? error.message : String(error) }); }
    return status;
  };

  ipcMain.handle('update:check', check);
  ipcMain.handle('update:download', async () => {
    if (status.status !== 'available') return status;
    publish({ ...status, status: 'downloading', percent: 0 });
    try { await autoUpdater.downloadUpdate(); }
    catch (error) { publish({ status: 'error', currentVersion: app.getVersion(), message: error instanceof Error ? error.message : String(error) }); }
    return status;
  });
  ipcMain.handle('update:install', () => { if (status.status === 'downloaded') autoUpdater.quitAndInstall(); });

  if (!app.isPackaged) {
    publish({ status: 'unsupported', currentVersion: app.getVersion(), message: 'Updates are available in installed builds.' });
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('update-available', info => publish({ status: 'available', currentVersion: app.getVersion(), availableVersion: info.version }));
  autoUpdater.on('update-not-available', () => publish({ status: 'not-available', currentVersion: app.getVersion() }));
  autoUpdater.on('download-progress', progress => publish({ ...status, status: 'downloading', percent: Math.round(progress.percent) }));
  autoUpdater.on('update-downloaded', info => publish({ status: 'downloaded', currentVersion: app.getVersion(), availableVersion: info.version }));
  autoUpdater.on('error', error => publish({ status: 'error', currentVersion: app.getVersion(), message: error.message }));

  initialCheck = setTimeout(() => { void check(); }, 5000);
  checkTimer = setInterval(() => { void check(); }, 15 * 60 * 1000);
  app.on('will-quit', () => {
    if (initialCheck) clearTimeout(initialCheck);
    if (checkTimer) clearInterval(checkTimer);
  });
}
