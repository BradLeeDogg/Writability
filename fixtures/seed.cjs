#!/usr/bin/env node
/* Seed realistic test papers into a Writability data dir (default: fixtures/data).
   Writes the same on-disk format as src/main/services/{papers,db}.ts (schema v1).
   Usage: node fixtures/seed.cjs [dataDir]   — safe to re-run (wipes only papers/). */
const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

const dataDir = path.resolve(process.argv[2] || path.join(__dirname, 'data'))
const papersDir = path.join(dataDir, 'papers')
fs.rmSync(papersDir, { recursive: true, force: true })
fs.mkdirSync(papersDir, { recursive: true })

const LOREM = 'The evidence gathered across three decades points in one clear direction, and yet the debate continues because each side reads the same numbers through different commitments. This paragraph exists to give the document realistic bulk, sentence rhythm, and enough length that scrolling, spell-checking, and read-aloud all face real work.'
const para = (t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })
const h2 = (t) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: t }] })

function doc(words, sections) {
  const content = []
  const parasNeeded = Math.ceil(words / 55)
  const perSection = Math.max(1, Math.floor(parasNeeded / sections))
  for (let s = 1; s <= sections; s++) {
    content.push(h2(`Section ${s}: development of the argument`))
    for (let p = 0; p < perSection; p++) content.push(para(LOREM))
  }
  return { type: 'doc', content }
}
const node = (kind, label, text, done, children = []) => ({
  id: 'node_' + Math.random().toString(36).slice(2, 10), kind, label, prompt: '', text, done, children
})
const src = (i, type) => ({
  id: 'src_' + i, type, authors: `Author ${i}, A.`, title: `Source title number ${i}`,
  containerTitle: type === 'article' ? 'Journal of Serious Studies' : undefined,
  publisher: type === 'book' ? 'University Press' : undefined, year: String(1990 + (i % 35)),
  url: type === 'web' ? `https://example.org/${i}` : undefined,
  accessed: type === 'web' ? '2026-06-01' : undefined, pages: i % 3 ? `${i}-${i + 9}` : undefined
})
const req = (text, done) => ({ id: 'req_' + Math.random().toString(36).slice(2, 10), text, done })
const card = (i, text, section) => ({ id: 'card_' + i, text, x: (i % 8) * 210 + 20, y: Math.floor(i / 8) * 130 + 20, color: ['yellow', 'blue', 'green', 'pink'][i % 4], section })

function writePaper(meta, content) {
  const dir = path.join(papersDir, meta.id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'paper.json'), JSON.stringify({ meta }, null, 2))
  const db = new Database(path.join(dir, 'paper.db'))
  db.pragma('journal_mode = WAL')
  db.exec(`CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE doc (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL);
    CREATE TABLE outline_nodes (id TEXT PRIMARY KEY, parent_id TEXT, position INTEGER NOT NULL,
      kind TEXT NOT NULL, label TEXT NOT NULL, prompt TEXT NOT NULL, text TEXT NOT NULL, done INTEGER NOT NULL);
    CREATE TABLE sources (id TEXT PRIMARY KEY, position INTEGER NOT NULL, type TEXT NOT NULL,
      authors TEXT NOT NULL, title TEXT NOT NULL, container_title TEXT, publisher TEXT, year TEXT,
      url TEXT, accessed TEXT, volume TEXT, issue TEXT, pages TEXT);`)
  db.prepare(`INSERT INTO meta (key,value) VALUES ('schema_version','1')`).run()
  db.prepare(`INSERT INTO doc (id,json) VALUES (1,?)`).run(JSON.stringify(content.doc))
  db.prepare(`INSERT INTO meta (key,value) VALUES ('assignment',?)`).run(JSON.stringify(content.assignment))
  db.prepare(`INSERT INTO meta (key,value) VALUES ('scratch',?)`).run(content.scratch || '')
  db.prepare(`INSERT INTO meta (key,value) VALUES ('cards',?)`).run(JSON.stringify(content.cards || []))
  const insNode = db.prepare(`INSERT INTO outline_nodes VALUES (?,?,?,?,?,?,?,?)`)
  const walk = (nodes, parent) => nodes.forEach((n, i) => {
    insNode.run(n.id, parent, i, n.kind, n.label, n.prompt, n.text, n.done ? 1 : 0)
    walk(n.children || [], n.id)
  })
  walk(content.outline || [], null)
  const insSrc = db.prepare(`INSERT INTO sources VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  ;(content.sources || []).forEach((s, i) => insSrc.run(s.id, i, s.type, s.authors, s.title,
    s.containerTitle ?? null, s.publisher ?? null, s.year ?? null, s.url ?? null, s.accessed ?? null,
    s.volume ?? null, s.issue ?? null, s.pages ?? null))
  db.close()
}

const now = new Date().toISOString()
const stale = new Date(Date.now() - 21 * 864e5).toISOString() // 3 weeks ago
const baseMeta = (id, title, essayType, extra = {}) => ({
  id, title, essayType, createdAt: stale, updatedAt: now, format: 'mla',
  heading: { studentName: 'Jordan Rivera', instructor: 'Dr. Okafor', course: 'HIST 301', date: '1 Jul 2026' },
  pageNumbers: true, ...extra
})

// 1. "Novel-scale" long paper: ~15,000 words, 12 sections, 60 board cards, mixed outline states.
writePaper(baseMeta('fx_long', 'The Long Thesis Paper (15k words)', 'thesis', { wordGoal: 15000, dueDate: '2026-07-20' }), {
  doc: doc(15000, 12),
  outline: [node('thesis', 'Thesis', 'Institutions, not individuals, drove the change.', true),
    ...Array.from({ length: 12 }, (_, i) => node('point', `Point ${i + 1}`, `Working claim ${i + 1}`, i < 5,
      [node('evidence', 'Evidence', i < 5 ? 'Cited below' : '', i < 5), node('analysis', 'Analysis', '', false)]))],
  sources: Array.from({ length: 40 }, (_, i) => src(i + 1, ['article', 'book', 'web'][i % 3])),
  assignment: { prompt: 'Write a 15,000-word thesis. Use at least 30 scholarly sources in MLA style.\nRubric:\n- Argument: clear and sustained (40 points)\n- Evidence: sources used critically (40 points)\n- Mechanics (20 points)',
    requirements: [req('Write at least 15000 words.', false), req('Use at least 30 sources.', true),
      req('Graded on: Argument: clear and sustained (40 points)', false),
      req('Graded on: Evidence: sources used critically (40 points)', false)] },
  scratch: 'Ideas parking lot: revisit chapter 3 framing; ask Dr. O about archive access.',
  cards: Array.from({ length: 60 }, (_, i) => card(i, `Idea ${i + 1}: a scene-level point to place`, undefined))
})

// 2. 400-word news brief, mid-draft (deadline persona).
writePaper(baseMeta('fx_brief', 'Campus Water Main Break (news brief)', 'argument', { wordGoal: 400, dueDate: '2026-07-02', format: 'none' }), {
  doc: doc(220, 1), outline: [node('thesis', 'Nut graf', 'Water restored by 6pm, classes resume Monday.', false)],
  sources: [src(1, 'web'), src(2, 'web')],
  assignment: { prompt: 'File a 400-word brief by 6pm. Two sources minimum. AP-adjacent style.', requirements: [req('Write about 400 words.', false), req('Use at least 2 sources.', true)] },
  scratch: '', cards: []
})

// 3. Dissertation-scale: 5 chapters, 200 references (APA).
writePaper(baseMeta('fx_diss', 'Dissertation: Attention & Interface Design', 'research', { format: 'apa', wordGoal: 40000 }), {
  doc: doc(8000, 5),
  outline: Array.from({ length: 5 }, (_, i) => node('section', `Chapter ${i + 1}`, `Chapter ${i + 1} summary`, i < 2)),
  sources: Array.from({ length: 200 }, (_, i) => src(i + 1, ['article', 'book', 'web'][i % 3])),
  assignment: { prompt: 'Dissertation. APA 7. Five chapters. Committee review in October.', requirements: [] },
  scratch: '', cards: []
})

// 4. Short reflection, minimal ceremony.
writePaper(baseMeta('fx_short', 'Reflection on the internship', 'reflection', { format: 'none', wordGoal: 800 }), {
  doc: doc(350, 1), outline: [node('thesis', 'Focus', '', false)], sources: [],
  assignment: { prompt: '', requirements: [] }, scratch: '', cards: []
})

// 5. Book-proposal-like argument paper with annotated outline + cards sorted into sections.
const propOutline = [node('thesis', 'Thesis', 'A trade book on attention is viable now.', true),
  ...Array.from({ length: 8 }, (_, i) => node('section', `TOC ${i + 1}`, `Chapter ${i + 1}: annotated summary`, i < 3))]
writePaper(baseMeta('fx_prop', 'Book Proposal: The Attention Ledger', 'argument', { format: 'chicago' }), {
  doc: doc(3000, 3), outline: propOutline,
  sources: Array.from({ length: 12 }, (_, i) => src(i + 1, 'book')),
  assignment: { prompt: 'Proposal package: annotated TOC and two sample chapters. Chicago style.', requirements: [req('Include a title page.', true)] },
  scratch: '', cards: Array.from({ length: 16 }, (_, i) => card(i, `Comp title ${i + 1}`, propOutline[1 + (i % 8)].id))
})

console.log('Seeded 5 papers into', papersDir)
