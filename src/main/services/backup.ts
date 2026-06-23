import { app, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { importPaper, listPapers, openPaper } from './papers'
import { getSettings, saveSettings } from './settings'
import type { BackupResult, RestoreResult } from '@shared/api'
import type { AppSettings, Paper } from '@shared/types'

// A backup is a single, human-readable JSON file holding every paper (full
// content) plus the student's settings. One file is easy to move to a USB
// stick, email to yourself, or drop in a cloud folder — and easy to restore.
// All offline; nothing is ever sent anywhere.

const BACKUP_VERSION = 1

export interface BackupBundle {
  app: 'writability'
  version: number
  appVersion: string
  createdAt: string
  settings: AppSettings
  papers: Paper[]
}

/** Gather everything into a restorable bundle. */
export function buildBundle(): BackupBundle {
  const papers: Paper[] = []
  for (const summary of listPapers()) {
    const paper = openPaper(summary.id)
    if (paper) papers.push(paper)
  }
  return {
    app: 'writability',
    version: BACKUP_VERSION,
    appVersion: app.getVersion(),
    createdAt: new Date().toISOString(),
    settings: getSettings(),
    papers
  }
}

/** Restore a bundle: write back each paper (by id) and the saved settings. */
export function applyBundle(bundle: BackupBundle): number {
  if (!bundle || bundle.app !== 'writability' || !Array.isArray(bundle.papers)) {
    throw new Error('This file does not look like a Writability backup.')
  }
  let imported = 0
  for (const paper of bundle.papers) {
    if (!paper?.meta?.id || !paper.content) continue
    importPaper(paper)
    imported++
  }
  if (bundle.settings) saveSettings(bundle.settings)
  return imported
}

export async function createBackup(): Promise<BackupResult> {
  const stamp = new Date().toISOString().slice(0, 10)
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Writability backup',
    defaultPath: join(app.getPath('documents'), `writability-backup-${stamp}.json`),
    filters: [{ name: 'Writability backup', extensions: ['json'] }]
  })
  if (canceled || !filePath) return { ok: false, canceled: true }

  try {
    const bundle = buildBundle()
    await writeFile(filePath, JSON.stringify(bundle, null, 2), 'utf8')
    return { ok: true, path: filePath, count: bundle.papers.length }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export async function restoreBackup(): Promise<RestoreResult> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Restore from a Writability backup',
    properties: ['openFile'],
    filters: [{ name: 'Writability backup', extensions: ['json'] }]
  })
  if (canceled || !filePaths?.[0]) return { ok: false, canceled: true }

  try {
    const bundle = JSON.parse(await readFile(filePaths[0], 'utf8')) as BackupBundle
    return { ok: true, imported: applyBundle(bundle) }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
