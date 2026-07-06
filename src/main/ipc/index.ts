import { app, dialog, ipcMain, shell } from 'electron'
import * as papers from '../services/papers'
import * as settings from '../services/settings'
import { exportPaper } from '../services/export'
import { createBackup, restoreBackup } from '../services/backup'
import { runAiTask } from '../services/ai'
import { dataDir } from '../services/paths'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import type { AiRunInput, CreatePaperInput, ExportInput, SavePaperInput } from '@shared/api'
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
  ipcMain.handle('papers:list-trash', () => papers.listTrash())
  ipcMain.handle('papers:restore', (_e, id: string) => papers.restorePaper(id))
  // Emergency plain-text save when normal saving is failing.
  ipcMain.handle('papers:rescue', async (_e, title: string, text: string) => {
    const safe = (title || 'paper').replace(/[^\w\- ]+/g, '').trim() || 'paper'
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save a copy of your writing',
      defaultPath: join(app.getPath('documents'), `${safe} (rescued copy).txt`),
      filters: [{ name: 'Plain text', extensions: ['txt'] }]
    })
    if (canceled || !filePath) return { ok: false, canceled: true }
    await writeFile(filePath, text, 'utf8')
    return { ok: true, path: filePath }
  })

  // Settings --------------------------------------------------------------
  ipcMain.handle('settings:get', () => settings.getSettings())
  ipcMain.handle('settings:save', (_e, s: AppSettings) => settings.saveSettings(s))

  // Export ----------------------------------------------------------------
  ipcMain.handle('export:paper', (_e, input: ExportInput) => exportPaper(input))

  // Backup ----------------------------------------------------------------
  ipcMain.handle('backup:create', () => createBackup())
  ipcMain.handle('backup:restore', () => restoreBackup())

  // AI (opt-in) -----------------------------------------------------------
  ipcMain.handle('ai:run', (_e, input: AiRunInput) => runAiTask(input))

  // Files -------------------------------------------------------------------
  ipcMain.handle('file:reveal', (_e, path: string) => shell.showItemInFolder(path))
  ipcMain.handle('file:open', async (_e, path: string) => {
    await shell.openPath(path)
  })

  // Misc ------------------------------------------------------------------
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    dataDir: dataDir(),
    platform: process.platform
  }))
}
