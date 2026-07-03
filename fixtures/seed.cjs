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
const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString()
const today = new Date().toISOString().slice(0, 10)
const baseMeta = (id, title, essayType, extra = {}) => ({
  id, title, essayType, createdAt: daysAgo(30), updatedAt: now, format: 'mla',
  heading: { studentName: 'Sam Ortiz', instructor: 'Prof. Adeyemi', course: 'ENG 210', date: today },
  pageNumbers: true, ...extra
})

// 1. College argumentative essay, APA, WITH detailed rubric (6-8 pages, 5 scholarly sources).
writePaper(baseMeta('fx_apa_rubric', 'Social Media and Civic Trust (APA, rubric)', 'argument', { format: 'apa', wordGoal: 2000, dueDate: daysAgo(-10).slice(0, 10) }), {
  doc: doc(900, 3),
  outline: [node('thesis', 'Thesis', 'Platform design, not user behavior, erodes civic trust.', true),
    node('point', 'Point 1', 'Engagement metrics reward outrage', true, [node('evidence', 'Evidence', 'Author 2 study', true), node('analysis', 'Analysis', '', false)]),
    node('point', 'Point 2', 'Moderation opacity', false), node('point', 'Point 3', '', false),
    node('section', 'Counterargument', '', false), node('section', 'Conclusion', '', false)],
  sources: Array.from({ length: 5 }, (_, i) => src(i + 1, 'article')),
  assignment: { prompt: 'Write a 6-8 page argumentative essay (APA 7). Use at least five scholarly sources. You must include a counterargument.\nRubric:\n- Thesis: arguable, specific (20 points)\n- Evidence: five scholarly sources integrated, not dropped in (30 points)\n- Organization: clear paragraphs with transitions (20 points)\n- Citations: correct APA in-text and references (20 points)\n- Mechanics (10 points)',
    requirements: [req('Write about 2000 words.', false), req('Use at least 5 sources.', true), req('Include a counterargument and respond to it.', false), req('Graded on: Citations: correct APA in-text and references (20 points)', false)] },
  scratch: '', cards: []
})

// 2. Same assignment, VAGUE version — the primary-persona fixture. Blank page.
writePaper(baseMeta('fx_vague', 'Memory in Beloved (vague prompt)', 'argument', { format: 'mla', wordGoal: 2000 }), {
  doc: { type: 'doc', content: [{ type: 'paragraph' }] },
  outline: [node('thesis', 'Thesis', '', false), node('point', 'Point 1', '', false), node('point', 'Point 2', '', false), node('point', 'Point 3', '', false), node('section', 'Counterargument', '', false), node('section', 'Conclusion', '', false)],
  sources: [], assignment: { prompt: 'Discuss the role of memory in Beloved.', requirements: [] }, scratch: '', cards: []
})

// 3. High-school five-paragraph persuasive essay with teacher rubric (504-plan persona).
writePaper(baseMeta('fx_hs5', 'Should School Start Later? (5-paragraph)', 'argument', { format: 'mla', wordGoal: 600, heading: { studentName: 'Riley Chen', instructor: 'Ms. Park', course: 'English 10', date: today } }), {
  doc: doc(180, 1),
  outline: [node('thesis', 'Thesis', 'School should start at 9am.', true), node('point', 'Point 1', 'Sleep science', true), node('point', 'Point 2', 'Grades improve', false), node('point', 'Point 3', '', false), node('section', 'Conclusion', '', false)],
  sources: [src(1, 'web'), src(2, 'web')],
  assignment: { prompt: 'Write a five-paragraph persuasive essay.\nRubric:\n- Clear thesis in the first paragraph (5 points)\n- Three body paragraphs, each with one reason and one example (15 points)\n- Conclusion restates thesis (5 points)\n- Spelling and grammar (5 points)',
    requirements: [req('Graded on: Clear thesis in the first paragraph (5 points)', true), req('Graded on: Three body paragraphs, each with one reason and one example (15 points)', false)] },
  scratch: '', cards: []
})

// 4. The messy brain-dump: ideas exist, structure does not — the core struggle.
writePaper(baseMeta('fx_dump', 'Untitled paper (brain dump)', 'research', { format: 'mla' }), {
  doc: { type: 'doc', content: [{ type: 'paragraph' }] },
  outline: [node('thesis', 'Research question & thesis', '', false)],
  sources: [src(1, 'book'), src(2, 'web')],
  assignment: { prompt: '', requirements: [] },
  scratch: 'quote about doors of memory p.117?? / rememory = place-memory / Sethe cant not remember / compare Baby Suggs sermon / TRAUMA IS NOT LINEAR - this is the thesis maybe? / that article on postmemory (find it) / bridge scene / milk scene do I even use this / 124 as a character?? / dont forget topic sentences',
  cards: Array.from({ length: 25 }, (_, i) => card(i, ['rememory as geography', 'the house as antagonist', 'Paul D tobacco tin heart', 'Denver leaves the yard = growth', 'ghost = unprocessed grief'][i % 5] + ' (' + (i + 1) + ')', undefined))
})

// 5. Mid-draft abandoned three weeks ago (re-entry / burnout test).
const staleDoc = doc(1200, 4)
writePaper({ ...baseMeta('fx_stale', 'The Ethics of Predictive Policing', 'research', { wordGoal: 2500, dueDate: daysAgo(-7).slice(0, 10) }), updatedAt: daysAgo(21) }, {
  doc: staleDoc,
  outline: [node('thesis', 'Research question & thesis', 'Predictive policing launders bias through math.', true),
    node('section', 'Background', 'done-ish', true), node('point', 'Point 1', 'Feedback loops', true), node('point', 'Point 2', 'Accountability gap', false), node('section', 'Conclusion', '', false)],
  sources: Array.from({ length: 8 }, (_, i) => src(i + 1, ['article', 'web'][i % 2])),
  assignment: { prompt: 'Research paper, 2500 words, MLA, 8 sources.', requirements: [req('Write about 2500 words.', false), req('Use at least 8 sources.', true)] },
  scratch: 'STOPPED AT: rewrite the accountability section, it contradicts point 1', cards: []
})

// 6. Due at 11:59 TONIGHT, partial progress (ADHD persona).
writePaper(baseMeta('fx_tonight', 'Rhetorical Analysis: MLK Letter (due tonight)', 'argument', { wordGoal: 1500, dueDate: today }), {
  doc: doc(600, 2),
  outline: [node('thesis', 'Thesis', 'MLK builds authority through kairos and pathos.', true),
    node('point', 'Point 1', 'Kairos: the timing argument', true), node('point', 'Point 2', 'Pathos: the imagery', false), node('point', 'Point 3', '', false), node('section', 'Conclusion', '', false)],
  sources: [src(1, 'book')],
  assignment: { prompt: 'Rhetorical analysis, 1500 words, MLA, due 11:59pm.', requirements: [req('Write about 1500 words.', false)] },
  scratch: '', cards: []
})

// 7. Dissertation-scale stress fixture kept from v1 (200 references, APA).
writePaper(baseMeta('fx_diss', 'Dissertation: Attention & Interface Design', 'research', { format: 'apa', wordGoal: 40000 }), {
  doc: doc(8000, 5),
  outline: Array.from({ length: 5 }, (_, i) => node('section', `Chapter ${i + 1}`, '', i < 2)),
  sources: Array.from({ length: 200 }, (_, i) => src(i + 1, ['article', 'book', 'web'][i % 3])),
  assignment: { prompt: 'Dissertation. APA 7.', requirements: [] }, scratch: '', cards: []
})

console.log('Seeded 7 cognitive-audit fixtures into', papersDir)
