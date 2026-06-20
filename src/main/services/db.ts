import Database from 'better-sqlite3'
import { dirname } from 'path'
import { ensureDir } from './atomic'
import { paperDbPath } from './paths'
import { emptyDoc } from '@shared/doc'
import type {
  CitationSource,
  OutlineKind,
  OutlineNode,
  PaperContent,
  SourceType
} from '@shared/types'

const SCHEMA_VERSION = 1

interface OutlineRow {
  id: string
  parent_id: string | null
  position: number
  kind: string
  label: string
  prompt: string
  text: string
  done: number
}

interface SourceRow {
  id: string
  position: number
  type: string
  authors: string
  title: string
  container_title: string | null
  publisher: string | null
  year: string | null
  url: string | null
  accessed: string | null
  volume: string | null
  issue: string | null
  pages: string | null
}

export function openPaperDb(id: string): Database.Database {
  const file = paperDbPath(id)
  ensureDir(dirname(file))
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  migrate(db)
  return db
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS doc (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outline_nodes (
      id TEXT PRIMARY KEY,
      parent_id TEXT,
      position INTEGER NOT NULL,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      prompt TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL DEFAULT '',
      done INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      position INTEGER NOT NULL,
      type TEXT NOT NULL,
      authors TEXT NOT NULL DEFAULT '[]',
      title TEXT NOT NULL DEFAULT '',
      container_title TEXT,
      publisher TEXT,
      year TEXT,
      url TEXT,
      accessed TEXT,
      volume TEXT,
      issue TEXT,
      pages TEXT
    );
  `)
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined
  if (!row) {
    db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)`).run(
      String(SCHEMA_VERSION)
    )
  }
}

export function readContent(db: Database.Database): PaperContent {
  const docRow = db.prepare('SELECT json FROM doc WHERE id = 1').get() as
    | { json: string }
    | undefined
  const doc = docRow?.json ? safeParse(docRow.json, emptyDoc()) : emptyDoc()

  const nodeRows = db
    .prepare('SELECT * FROM outline_nodes ORDER BY position ASC')
    .all() as OutlineRow[]
  const outline = buildTree(nodeRows)

  const sourceRows = db.prepare('SELECT * FROM sources ORDER BY position ASC').all() as SourceRow[]
  const sources = sourceRows.map(rowToSource)

  return { doc, outline, sources }
}

export function writeContent(db: Database.Database, content: PaperContent): void {
  const tx = db.transaction((c: PaperContent) => {
    db.prepare('INSERT OR REPLACE INTO doc (id, json) VALUES (1, ?)').run(
      JSON.stringify(c.doc ?? emptyDoc())
    )

    db.prepare('DELETE FROM outline_nodes').run()
    const insNode = db.prepare(`
      INSERT INTO outline_nodes (id, parent_id, position, kind, label, prompt, text, done)
      VALUES (@id, @parent_id, @position, @kind, @label, @prompt, @text, @done)
    `)
    let pos = 0
    const walk = (nodes: OutlineNode[], parent: string | null): void => {
      for (const n of nodes) {
        insNode.run({
          id: n.id,
          parent_id: parent,
          position: pos++,
          kind: n.kind,
          label: n.label,
          prompt: n.prompt ?? '',
          text: n.text ?? '',
          done: n.done ? 1 : 0
        })
        if (n.children?.length) walk(n.children, n.id)
      }
    }
    walk(c.outline ?? [], null)

    db.prepare('DELETE FROM sources').run()
    const insSrc = db.prepare(`
      INSERT INTO sources (id, position, type, authors, title, container_title, publisher,
                           year, url, accessed, volume, issue, pages)
      VALUES (@id, @position, @type, @authors, @title, @container_title, @publisher,
              @year, @url, @accessed, @volume, @issue, @pages)
    `)
    ;(c.sources ?? []).forEach((s, i) => {
      insSrc.run({
        id: s.id,
        position: i,
        type: s.type,
        authors: JSON.stringify(s.authors ?? []),
        title: s.title ?? '',
        container_title: s.containerTitle ?? null,
        publisher: s.publisher ?? null,
        year: s.year ?? null,
        url: s.url ?? null,
        accessed: s.accessed ?? null,
        volume: s.volume ?? null,
        issue: s.issue ?? null,
        pages: s.pages ?? null
      })
    })
  })
  tx(content)
}

function buildTree(rows: OutlineRow[]): OutlineNode[] {
  const map = new Map<string, OutlineNode>()
  const roots: OutlineNode[] = []
  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      kind: r.kind as OutlineKind,
      label: r.label,
      prompt: r.prompt,
      text: r.text,
      done: !!r.done,
      children: []
    })
  }
  for (const r of rows) {
    const node = map.get(r.id)
    if (!node) continue
    if (r.parent_id && map.has(r.parent_id)) {
      map.get(r.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function rowToSource(r: SourceRow): CitationSource {
  return {
    id: r.id,
    type: r.type as SourceType,
    authors: safeParse<string[]>(r.authors, []),
    title: r.title,
    containerTitle: r.container_title ?? undefined,
    publisher: r.publisher ?? undefined,
    year: r.year ?? undefined,
    url: r.url ?? undefined,
    accessed: r.accessed ?? undefined,
    volume: r.volume ?? undefined,
    issue: r.issue ?? undefined,
    pages: r.pages ?? undefined
  }
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}
