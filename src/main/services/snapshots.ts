// Per-paper snapshots: quiet, automatic copies of a paper's content so nothing
// is ever more than one restore away. Stored as plain JSON files under the
// paper's folder; the newest 20 are kept.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { paperDir } from './paths'
import { openPaper, savePaper } from './papers'
import { docToPlainText, countWords } from '@shared/doc'
import type { PaperContent } from '@shared/types'

const KEEP = 20

function snapDir(id: string): string {
  return join(paperDir(id), 'snapshots')
}

export interface SnapshotInfo {
  file: string
  at: string
  words: number
}

/** Write a snapshot of the paper's current content. Returns its info. */
export function snapshotPaper(id: string): SnapshotInfo | null {
  const paper = openPaper(id)
  if (!paper) return null
  const dir = snapDir(id)
  mkdirSync(dir, { recursive: true })
  const at = new Date().toISOString()
  const file = at.replace(/[:.]/g, '-') + '.json'
  const words = countWords(docToPlainText(paper.content.doc))
  writeFileSync(join(dir, file), JSON.stringify({ at, words, content: paper.content }), 'utf8')
  prune(id)
  return { file, at, words }
}

export function listSnapshots(id: string): SnapshotInfo[] {
  const dir = snapDir(id)
  if (!existsSync(dir)) return []
  const out: SnapshotInfo[] = []
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    try {
      const data = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { at: string; words: number }
      out.push({ file: f, at: data.at, words: data.words })
    } catch {
      // Unreadable snapshot: skip it rather than fail the list.
    }
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1))
}

/** Restore a snapshot. The current state is snapshotted first, so restoring
 *  can itself always be undone. */
export function restoreSnapshot(id: string, file: string): { ok: boolean } {
  const path = join(snapDir(id), file)
  if (!existsSync(path)) return { ok: false }
  const paper = openPaper(id)
  if (!paper) return { ok: false }
  const data = JSON.parse(readFileSync(path, 'utf8')) as { content: PaperContent }
  snapshotPaper(id)
  savePaper({ meta: paper.meta, content: data.content })
  return { ok: true }
}

function prune(id: string): void {
  const all = listSnapshots(id)
  for (const extra of all.slice(KEEP)) rmSync(join(snapDir(id), extra.file), { force: true })
}
