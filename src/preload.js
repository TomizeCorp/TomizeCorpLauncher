const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('launcher', {
  settings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: value => ipcRenderer.invoke('settings:save', value),
  pickFolder: () => ipcRenderer.invoke('folder:pick'),
  pickFile: () => ipcRenderer.invoke('file:pick'),
  openInstance: () => ipcRenderer.invoke('instance:open'),
  copyServer: address => ipcRenderer.invoke('server:copy', address),
  sync: () => ipcRenderer.invoke('sync:start'),
  play: () => ipcRenderer.invoke('play'),
  openEpsilon: () => ipcRenderer.invoke('epsilon:open'),
  loginOffline: username => ipcRenderer.invoke('auth:offline', username),
  loginMicrosoft: rememberSession => ipcRenderer.invoke('auth:microsoft', rememberSession),
  logout: () => ipcRenderer.invoke('auth:logout'),
  registerEpsilon: credentials => ipcRenderer.invoke('auth:register', credentials),
  loginEpsilon: credentials => ipcRenderer.invoke('auth:login', credentials),
  launchGame: profile => ipcRenderer.invoke('game:launch', profile),
  onProgress: callback => ipcRenderer.on('sync-progress', (_, value) => callback(value))
});
