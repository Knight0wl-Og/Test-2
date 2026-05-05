const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getKey: (name) => ipcRenderer.invoke('key:get', name),
  setKey: (name, value) => ipcRenderer.invoke('key:set', name, value),
  deleteKey: (name) => ipcRenderer.invoke('key:delete', name),
  clearAllKeys: () => ipcRenderer.invoke('key:clear'),
  getAllKeys: () => ipcRenderer.invoke('key:getAll'),
});
