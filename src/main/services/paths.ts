import { app } from 'electron'
import { join } from 'path'

// All filesystem locations live here. A paper is a folder containing
// project.db (SQLite) plus a paper.json sidecar used for fast listing.
//
// WP_DATA_DIR lets the self-test / smoke harness redirect storage to a
// throwaway folder so it never touches the user's real papers.

export function dataDir(): string {
  const override = process.env.WP_DATA_DIR
  if (override && override.length > 0) return override
  return join(app.getPath('documents'), 'Writability')
}

export function papersDir(): string {
  return join(dataDir(), 'Papers')
}

export function paperDir(id: string): string {
  return join(papersDir(), id)
}

export function paperDbPath(id: string): string {
  return join(paperDir(id), 'project.db')
}

export function paperSidecarPath(id: string): string {
  return join(paperDir(id), 'paper.json')
}

export function settingsPath(): string {
  return join(dataDir(), 'settings.json')
}
