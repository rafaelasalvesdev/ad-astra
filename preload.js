// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astraAPI', {
    getPrompts: () => ipcRenderer.invoke('get-prompts'),
    savePrompts: (prompts) => ipcRenderer.invoke('save-prompts', prompts),
    getMetadata: () => ipcRenderer.invoke('get-metadata'),
    saveMetadata: (meta) => ipcRenderer.invoke('save-metadata', meta)
});