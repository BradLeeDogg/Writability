import { existsSync, readdirSync, renameSync, rmSync } from 'fs'
import { join } from 'path'
import { ensureDir, readJson, writeJsonAtomic } from './atomic'
import { openPaperDb, readContent, writeContent } from './db'
import { paperDir, paperSidecarPath, papersDir, trashDir } from './paths'
import { emptyDoc } from '@shared/doc'
import { uid } from '@shared/ids'
import { makeOutline } from '@shared/outline-templates'
import type { CreatePaperInput, SavePaperInput, SavePaperResult } from '@shared/api'
import type { Paper, PaperMeta, PaperSummary } from '@shared/types'

interface Sidecar {
  meta: PaperMeta
}

export function listPapers(): PaperSummary[] {
  const dir = papersDir()
  if (!existsSync(dir)) return []
  const out: PaperSummary[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const side = readJson<Sidecar | null>(paperSidecarPath(entry.name), null)
    if (!side?.meta) continue
    out.push({
      id: side.meta.id,
      title: side.meta.title,
      essayType: side.meta.essayType,
      updatedAt: side.meta.updatedAt,
      dir: paperDir(entry.name)
    })
  }
  // Most recently edited first.
  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return out
}

export function createPaper(input: CreatePaperInput): Paper {
  const id = uid('paper')
  const now = new Date().toISOString()
  const format = input.format ?? 'none'
  const meta: PaperMeta = {
    id,
    title: input.title?.trim() || 'Untitled paper',
    essayType: input.essayType,
    createdAt: now,
    updatedAt: now,
    format,
    heading: {},
    pageNumbers: format !== 'none'
  }
  ensureDir(paperDir(id))
  const content: Paper['content'] = {
    doc: emptyDoc(),
    outline: makeOutline(input.essayType),
    sources: [],
    assignment: { prompt: '', requirements: [] },
    scratch: '',
    cards: []
  }
  const db = openPaperDb(id)
  try {
    writeContent(db, content)
  } finally {
    db.close()
  }
  writeJsonAtomic(paperSidecarPath(id), { meta } satisfies Sidecar)
  return { meta, content }
}

export function openPaper(id: string): Paper | null {
  if (!existsSync(paperDir(id))) return null
  const side = readJson<Sidecar | null>(paperSidecarPath(id), null)
  if (!side?.meta) return null
  const db = openPaperDb(id)
  try {
    return { meta: side.meta, content: readContent(db) }
  } finally {
    db.close()
  }
}

export function savePaper(input: SavePaperInput): SavePaperResult {
  const now = new Date().toISOString()
  const meta: PaperMeta = { ...input.meta, updatedAt: now }
  ensureDir(paperDir(meta.id))
  const db = openPaperDb(meta.id)
  try {
    writeContent(db, input.content)
  } finally {
    db.close()
  }
  writeJsonAtomic(paperSidecarPath(meta.id), { meta } satisfies Sidecar)
  return { ok: true, updatedAt: now }
}

/**
 * Write a complete paper exactly as given, preserving its id and timestamps.
 * Used by backup-restore (unlike savePaper, which stamps a fresh updatedAt).
 */
export function importPaper(paper: Paper): void {
  ensureDir(paperDir(paper.meta.id))
  const db = openPaperDb(paper.meta.id)
  try {
    writeContent(db, paper.content)
  } finally {
    db.close()
  }
  writeJsonAtomic(paperSidecarPath(paper.meta.id), { meta: paper.meta } satisfies Sidecar)
}

// Deleting moves the paper to the trash so it is always recoverable; trashed
// papers older than 30 days are pruned on the next delete.
const TRASH_KEEP_MS = 30 * 24 * 60 * 60 * 1000

export function deletePaper(id: string): { ok: boolean } {
  const dir = paperDir(id)
  if (existsSync(dir)) {
    ensureDir(trashDir())
    const dest = join(trashDir(), id)
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
    renameSync(dir, dest)
  }
  pruneTrash()
  return { ok: true }
}

function trashedMeta(id: string): PaperMeta | null {
  const sidecar = join(trashDir(), id, 'paper.json')
  const data = readJson<Sidecar | null>(sidecar, null)
  return data?.meta ?? null
}

export function listTrash(): PaperSummary[] {
  const dir = trashDir()
  if (!existsSync(dir)) return []
  const out: PaperSummary[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const meta = trashedMeta(entry.name)
    if (meta) out.push({ id: meta.id, title: meta.title, essayType: meta.essayType, updatedAt: meta.updatedAt, dir: join(trashDir(), meta.id) })
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export function restorePaper(id: string): { ok: boolean } {
  const src = join(trashDir(), id)
  if (!existsSync(src)) return { ok: false }
  const dest = paperDir(id)
  if (existsSync(dest)) return { ok: false }
  ensureDir(papersDir())
  renameSync(src, dest)
  return { ok: true }
}

function pruneTrash(): void {
  const dir = trashDir()
  if (!existsSync(dir)) return
  const cutoff = Date.now() - TRASH_KEEP_MS
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const meta = trashedMeta(entry.name)
    const when = meta ? Date.parse(meta.updatedAt) : 0
    if (when < cutoff) rmSync(join(dir, entry.name), { recursive: true, force: true })
  }
}
