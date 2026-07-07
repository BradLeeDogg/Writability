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
  listTrash: () => ipcRenderer.invoke('papers:list-trash'),
  restorePaper: (id) => ipcRenderer.invoke('papers:restore', id),
  rescueText: (title, text) => ipcRenderer.invoke('papers:rescue', title, text),
  takeSnapshot: (id) => ipcRenderer.invoke('snapshots:take', id),
  listSnapshots: (id) => ipcRenderer.invoke('snapshots:list', id),
  restoreSnapshot: (id, file) => ipcRenderer.invoke('snapshots:restore', id, file),
  importDocx: () => ipcRenderer.invoke('papers:import-docx'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  exportPaper: (input) => ipcRenderer.invoke('export:paper', input),

  createBackup: () => ipcRenderer.invoke('backup:create'),
  restoreBackup: () => ipcRenderer.invoke('backup:restore'),

  runAi: (input) => ipcRenderer.invoke('ai:run', input),

  revealFile: (path) => ipcRenderer.invoke('file:reveal', path),
  openFile: (path) => ipcRenderer.invoke('file:open', path),

  onFlushRequest: (cb) => {
    ipcRenderer.on('app:flush', () => cb())
  },
  flushDone: () => ipcRenderer.send('app:flushed'),
  onUpdateReady: (cb) => {
    ipcRenderer.on('app:update-ready', (_e, version: string) => cb(version))
  },

  getAppInfo: () => ipcRenderer.invoke('app:info')
}

contextBridge.exposeInMainWorld('api', api)
