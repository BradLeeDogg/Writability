import assert from 'node:assert'
import { rmSync } from 'fs'
import { app } from 'electron'
import { writeJsonAtomic, readJson } from './services/atomic'
import { createPaper, deletePaper, listPapers, openPaper, savePaper } from './services/papers'
import { getSettings, saveSettings } from './services/settings'
import { renderExport } from './services/export'
import { dataDir } from './services/paths'
import { analyzeClarity } from '@shared/clarity'
import { formatCitation } from '@shared/citations'
import { docToPlainText } from '@shared/doc'
import { makeOutline, outlineProgress } from '@shared/outline-templates'

// Main-process assertions. Runs with WP_SELFTEST=1 and exits without UI.
export async function runSelftest(): Promise<void> {
  const checks: string[] = []
  const pass = (name: string): void => {
    checks.push(name)
  }

  try {
    // --- atomic JSON round-trip -----------------------------------------
    const probe = `${dataDir()}/__atomic_probe.json`
    writeJsonAtomic(probe, { hello: 'world', n: 42 })
    const back = readJson<{ hello: string; n: number }>(probe, { hello: '', n: 0 })
    assert.equal(back.hello, 'world')
    assert.equal(back.n, 42)
    rmSync(probe, { force: true })
    pass('atomic json round-trip')

    // --- outline templates ----------------------------------------------
    for (const t of ['argument', 'research', 'lab', 'thesis', 'reflection'] as const) {
      const o = makeOutline(t)
      assert.ok(o.length >= 3, `outline for ${t} has steps`)
      assert.equal(o[0].kind, 'thesis', `${t} starts with a thesis-like step`)
    }
    const prog = outlineProgress(makeOutline('argument'))
    assert.ok(prog.total > 0 && prog.done === 0)
    pass('outline templates')

    // --- paper create / save / reopen (SQLite + sidecar) ----------------
    const paper = createPaper({ title: 'Self-test paper', essayType: 'argument' })
    assert.ok(paper.meta.id.startsWith('paper-'))
    assert.ok(paper.content.outline.length >= 3)
    // The argument outline nests evidence/analysis under points.
    assert.ok(
      paper.content.outline.some((n) => n.children.length > 0),
      'outline is nested'
    )

    paper.content.doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world. This is a real test.' }] }
      ]
    }
    paper.content.outline[0].text = 'My working thesis.'
    paper.content.outline[0].done = true
    paper.content.sources.push({
      id: 'src-1',
      type: 'book',
      authors: ['Smith, John'],
      title: 'A Serious Book',
      publisher: 'University Press',
      year: '2020'
    })
    const saved = savePaper({ meta: paper.meta, content: paper.content })
    assert.equal(saved.ok, true)

    const reopened = openPaper(paper.meta.id)
    assert.ok(reopened, 'paper reopens')
    assert.equal(reopened!.content.outline[0].text, 'My working thesis.')
    assert.equal(reopened!.content.outline[0].done, true)
    assert.ok(reopened!.content.outline.some((n) => n.children.length > 0), 'nesting survives save')
    assert.equal(reopened!.content.sources.length, 1)
    assert.equal(reopened!.content.sources[0].title, 'A Serious Book')
    assert.ok(docToPlainText(reopened!.content.doc).includes('Hello world'))
    pass('paper persistence (sqlite + sidecar)')

    // --- listing --------------------------------------------------------
    const list = listPapers()
    assert.ok(list.some((p) => p.id === paper.meta.id), 'paper appears in listing')
    pass('paper listing')

    // --- settings -------------------------------------------------------
    const s = getSettings()
    assert.ok(s.theme)
    s.fontScale = 1.35
    s.fontFamily = 'opendyslexic'
    saveSettings(s)
    assert.equal(getSettings().fontScale, 1.35)
    assert.equal(getSettings().fontFamily, 'opendyslexic')
    pass('settings persistence')

    // --- clarity heuristics ---------------------------------------------
    const report = analyzeClarity(
      'The cat sat. The experiment was conducted by the team in a manner that was extraordinarily ' +
        'complicated and went on and on and on and on and on and on and on and on for far too many words. ' +
        'This shows the result.'
    )
    assert.ok(report.wordCount > 0)
    assert.ok(report.issues.some((i) => i.type === 'long-sentence'), 'flags long sentence')
    assert.ok(report.issues.some((i) => i.type === 'passive-voice'), 'flags passive voice')
    assert.ok(report.issues.some((i) => i.type === 'ambiguous-pronoun'), 'flags ambiguous pronoun')
    assert.ok(report.readingLabel.length > 0)
    pass('clarity heuristics')

    // --- citations ------------------------------------------------------
    const mla = formatCitation(
      { id: 'c1', type: 'book', authors: ['Smith, John'], title: 'A Book', publisher: 'Press', year: '2020' },
      'mla'
    )
    assert.ok(mla.reference.includes('Smith'))
    assert.ok(mla.reference.includes('A Book'))
    assert.ok(mla.inText.includes('Smith'))

    const apa = formatCitation(
      {
        id: 'c2',
        type: 'journal',
        authors: ['Doe, Jane'],
        title: 'On Things',
        containerTitle: 'Journal of Things',
        volume: '4',
        issue: '2',
        pages: '10-20',
        year: '2019'
      },
      'apa'
    )
    assert.ok(apa.reference.includes('2019'))
    assert.ok(apa.inText.includes('2019'))

    const chicago = formatCitation(
      { id: 'c3', type: 'website', authors: [], title: 'A Web Page', containerTitle: 'A Site', url: 'https://x.example', year: '2021' },
      'chicago'
    )
    assert.ok(chicago.reference.includes('A Web Page'))
    pass('citations (mla/apa/chicago)')

    // --- export ---------------------------------------------------------
    const docxBytes = await renderExport(reopened!, 'docx')
    assert.ok(docxBytes.length > 100, 'docx export non-empty')
    const txtBytes = await renderExport(reopened!, 'txt')
    assert.ok(txtBytes.toString('utf8').includes('Hello world'), 'txt export has prose')
    pass('export (docx + txt)')

    // --- cleanup --------------------------------------------------------
    deletePaper(paper.meta.id)
    assert.equal(openPaper(paper.meta.id), null, 'paper deleted')
    pass('delete paper')

    console.log(`SELFTEST_OK (${checks.length} checks: ${checks.join(', ')})`)
    cleanup()
    app.exit(0)
  } catch (err) {
    console.error('ASSERT FAILED:', (err as Error)?.message ?? err)
    if (err instanceof Error && err.stack) console.error(err.stack)
    cleanup()
    app.exit(1)
  }
}

function cleanup(): void {
  try {
    if (process.env.WP_DATA_DIR) rmSync(process.env.WP_DATA_DIR, { recursive: true, force: true })
  } catch {
    // best effort
  }
}
