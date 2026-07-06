// The contract exposed to the renderer as `window.api`.
//
// The IPC triad keeps these in lockstep:
//   1) ipcMain.handle('<channel>', ...) in src/main/ipc/index.ts
//   2) a binding in src/preload/index.ts
//   3) the typed signature here
//
// Pure, side-effect-free helpers (clarity analysis, citation formatting) live
// in shared/ and are imported directly by the renderer — they need no IPC.

import type { AiTask } from './ai'
import type {
  AppSettings,
  EssayType,
  ExportFormat,
  Paper,
  PaperContent,
  PaperFormat,
  PaperMeta,
  PaperSummary
} from './types'

export interface CreatePaperInput {
  title: string
  essayType: EssayType
  format?: PaperFormat
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

export interface BackupResult {
  ok: boolean
  /** Where the backup was written. */
  path?: string
  /** How many papers were saved. */
  count?: number
  canceled?: boolean
  error?: string
}

export interface RestoreResult {
  ok: boolean
  /** How many papers were brought back. */
  imported?: number
  canceled?: boolean
  error?: string
}

export interface AiRunInput {
  task: AiTask
  text: string
}

export interface AiRunResult {
  ok: boolean
  /** The model's reply (rewrite or tone note) on success. */
  text?: string
  /** A friendly, plain-language error when something goes wrong. */
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
  /** Papers in the trash (recently deleted), newest first. */
  listTrash(): Promise<PaperSummary[]>
  /** Bring a trashed paper back into the library. */
  restorePaper(id: string): Promise<{ ok: boolean }>
  /** Emergency plain-text save of the current document (save dialog). */
  rescueText(title: string, text: string): Promise<{ ok: boolean; canceled?: boolean; path?: string }>

  // Settings --------------------------------------------------------------
  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<{ ok: true }>

  // Export ----------------------------------------------------------------
  exportPaper(input: ExportInput): Promise<ExportResult>

  // Backup ----------------------------------------------------------------
  /** Write every paper + settings to a single backup file the student chooses. */
  createBackup(): Promise<BackupResult>
  /** Read a backup file and bring its papers (and settings) back. */
  restoreBackup(): Promise<RestoreResult>

  // AI (opt-in) -----------------------------------------------------------
  /** Run an opt-in AI task with the student's own key. Offline-safe: returns a
   *  friendly error if no key is set. Never called unless the student clicks. */
  runAi(input: AiRunInput): Promise<AiRunResult>

  // Files -----------------------------------------------------------------
  /** Reveal an exported file in the OS file manager. */
  revealFile(path: string): Promise<void>
  /** Open an exported file with its default app. */
  openFile(path: string): Promise<void>

  // Lifecycle ---------------------------------------------------------------
  /** Main asks the renderer to flush unsaved work before the window closes. */
  onFlushRequest(cb: () => void): void
  /** Renderer tells main the flush finished and the window may close. */
  flushDone(): void

  // Misc ------------------------------------------------------------------
  getAppInfo(): Promise<AppInfo>
}
