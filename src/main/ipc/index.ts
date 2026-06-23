import { app, ipcMain } from 'electron'
import * as papers from '../services/papers'
import * as settings from '../services/settings'
import { exportPaper } from '../services/export'
import { createBackup, restoreBackup } from '../services/backup'
import { dataDir } from '../services/paths'
import type { CreatePaperInput, ExportInput, SavePaperInput } from '@shared/api'
import type { AppSettings } from '@shared/types'

// The main-process half of the IPC triad. Each channel here has a matching
// binding in src/preload/index.ts and a typed signature in src/shared/api.ts.
export function registerIpc(): void {
  // Papers ----------------------------------------------------------------
  ipcMain.handle('papers:list', () => papers.listPapers())
  ipcMain.handle('papers:create', (_e, input: CreatePaperInput) => papers.createPaper(input))
  ipcMain.handle('papers:open', (_e, id: string) => papers.openPaper(id))
  ipcMain.handle('papers:save', (_e, input: SavePaperInput) => papers.savePaper(input))
  ipcMain.handle('papers:delete', (_e, id: string) => papers.deletePaper(id))

  // Settings --------------------------------------------------------------
  ipcMain.handle('settings:get', () => settings.getSettings())
  ipcMain.handle('settings:save', (_e, s: AppSettings) => settings.saveSettings(s))

  // Export ----------------------------------------------------------------
  ipcMain.handle('export:paper', (_e, input: ExportInput) => exportPaper(input))

  // Backup ----------------------------------------------------------------
  ipcMain.handle('backup:create', () => createBackup())
  ipcMain.handle('backup:restore', () => restoreBackup())

  // Misc ------------------------------------------------------------------
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    dataDir: dataDir(),
    platform: process.platform
  }))
}
