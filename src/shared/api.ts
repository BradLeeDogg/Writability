// The contract exposed to the renderer as `window.api`.
//
// The IPC triad keeps these in lockstep:
//   1) ipcMain.handle('<channel>', ...) in src/main/ipc/index.ts
//   2) a binding in src/preload/index.ts
//   3) the typed signature here
//
// Pure, side-effect-free helpers (clarity analysis, citation formatting) live
// in shared/ and are imported directly by the renderer — they need no IPC.

import type {
  AppSettings,
  EssayType,
  ExportFormat,
  Paper,
  PaperContent,
  PaperMeta,
  PaperSummary
} from './types'

export interface CreatePaperInput {
  title: string
  essayType: EssayType
}

export interface SavePaperInput {
  meta: PaperMeta
  content: PaperContent
}

export interface SavePaperResult {
  ok: true
  updatedAt: string
}

export interface ExportInput {
  id: string
  format: ExportFormat
}

export interface ExportResult {
  ok: boolean
  path?: string
  canceled?: boolean
  error?: string
}

export interface AppInfo {
  version: string
  dataDir: string
  /** process.platform, e.g. "win32" | "darwin" | "linux". */
  platform: string
}

export interface WritabilityApi {
  // Papers ----------------------------------------------------------------
  listPapers(): Promise<PaperSummary[]>
  createPaper(input: CreatePaperInput): Promise<Paper>
  openPaper(id: string): Promise<Paper | null>
  savePaper(input: SavePaperInput): Promise<SavePaperResult>
  deletePaper(id: string): Promise<{ ok: boolean }>

  // Settings --------------------------------------------------------------
  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<{ ok: true }>

  // Export ----------------------------------------------------------------
  exportPaper(input: ExportInput): Promise<ExportResult>

  // Misc ------------------------------------------------------------------
  getAppInfo(): Promise<AppInfo>
}
