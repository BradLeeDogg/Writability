import { existsSync, readdirSync, rmSync } from 'fs'
import { ensureDir, readJson, writeJsonAtomic } from './atomic'
import { openPaperDb, readContent, writeContent } from './db'
import { paperDir, paperSidecarPath, papersDir } from './paths'
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
  const meta: PaperMeta = {
    id,
    title: input.title?.trim() || 'Untitled paper',
    essayType: input.essayType,
    createdAt: now,
    updatedAt: now
  }
  ensureDir(paperDir(id))
  const content: Paper['content'] = {
    doc: emptyDoc(),
    outline: makeOutline(input.essayType),
    sources: []
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

export function deletePaper(id: string): { ok: boolean } {
  const dir = paperDir(id)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  return { ok: true }
}
