import { contextBridge, ipcRenderer } from 'electron'
import type { WritabilityApi } from '@shared/api'

// The renderer-facing half of the IPC triad. Thin forwarders only — all logic
// lives in the main process services.
const api: WritabilityApi = {
  listPapers: () => ipcRenderer.invoke('papers:list'),
  createPaper: (input) => ipcRenderer.invoke('papers:create', input),
  openPaper: (id) => ipcRenderer.invoke('papers:open', id),
  savePaper: (input) => ipcRenderer.invoke('papers:save', input),
  deletePaper: (id) => ipcRenderer.invoke('papers:delete', id),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  exportPaper: (input) => ipcRenderer.invoke('export:paper', input),

  createBackup: () => ipcRenderer.invoke('backup:create'),
  restoreBackup: () => ipcRenderer.invoke('backup:restore'),

  runAi: (input) => ipcRenderer.invoke('ai:run', input),

  getAppInfo: () => ipcRenderer.invoke('app:info')
}

contextBridge.exposeInMainWorld('api', api)
