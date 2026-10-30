const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  request: (path) => ipcRenderer.invoke('reader:request', path),
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  session: () => ipcRenderer.invoke('auth:session'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  openSite: () => ipcRenderer.send('external:open', 'https://estory.fauzulazim.com/'),
  update: {
    getStatus: () => ipcRenderer.invoke('update:getStatus'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onStatus: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('update:status', listener);
      return () => ipcRenderer.removeListener('update:status', listener);
    },
  },
  windowAction: (action) => ipcRenderer.send('window:action', action),
});
