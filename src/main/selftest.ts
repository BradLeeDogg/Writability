import assert from 'node:assert'
import { rmSync } from 'fs'
import { app } from 'electron'
import { writeJsonAtomic, readJson } from './services/atomic'
import { createPaper, deletePaper, listPapers, openPaper, savePaper } from './services/papers'
import { getSettings, saveSettings } from './services/settings'
import { renderExport } from './services/export'
import { applyBundle, buildBundle } from './services/backup'
import { runAiTask } from './services/ai'
import { dataDir } from './services/paths'
import { buildPrompt, isValidModel, splitIntoItems } from '@shared/ai'
import { analyzeClarity, suggestSentenceSplit } from '@shared/clarity'
import { decodeAssignment } from '@shared/assignment'
import { outlineToDocContent } from '@shared/scaffold'
import { TRANSITIONS } from '@shared/transitions'
import { GLOSSARY, glossaryMap } from '@shared/glossary'
import { summarizeSource } from '@shared/reading'
import { formatCitation } from '@shared/citations'
import { docToPlainText, splitSentences, sentenceIndexAt } from '@shared/doc'
import {
  findThesisNode,
  insertNoteUnder,
  makeBodyParagraph,
  makeOutline,
  nextBodyParagraphNumber,
  outlineProgress
} from '@shared/outline-templates'
import { checkOnThesis } from '@shared/thesis'
import { backPlan, nextAction } from '@shared/planner'

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

    // --- outline editing helpers + thesis check -------------------------
    const argOutline = makeOutline('argument')
    const pointsBefore = argOutline.filter((n) => n.kind === 'point').length
    assert.equal(nextBodyParagraphNumber(argOutline), pointsBefore + 1, 'next point number follows')
    const newPara = makeBodyParagraph(nextBodyParagraphNumber(argOutline))
    assert.equal(newPara.kind, 'point')
    assert.equal(newPara.children.length, 3, 'new body paragraph has evidence/analysis/link')
    assert.ok(findThesisNode(argOutline)?.kind === 'thesis', 'thesis node is found')

    const onTopic = checkOnThesis(
      'Recycling reduces landfill waste in cities.',
      'Recycling lowers the waste that cities send to the landfill each year.'
    )
    assert.ok(onTopic.checked && onTopic.onThesis, 'on-topic paragraph passes the thesis check')
    const offTopic = checkOnThesis(
      'Recycling reduces landfill waste in cities.',
      'My favourite football team finally won the championship last season.'
    )
    assert.ok(offTopic.checked && !offTopic.onThesis, 'off-topic paragraph is gently flagged')
    assert.equal(
      checkOnThesis('Recycling reduces landfill waste.', 'Yes.').checked,
      false,
      'too little text is not judged'
    )
    pass('outline editing + thesis check')

    // --- planner: next action + deadline back-plan ----------------------
    const planOutline = makeOutline('argument')
    const firstAction = nextAction(planOutline)
    assert.ok(firstAction && /thesis/i.test(firstAction.label), 'next action starts at the thesis')
    const markAll = (list: typeof planOutline): void => {
      for (const n of list) {
        n.done = true
        markAll(n.children)
      }
    }
    markAll(planOutline)
    assert.equal(nextAction(planOutline), null, 'no next action when everything is done')

    const now = new Date(2026, 0, 1)
    const future = backPlan('2026-01-05', 8, now)
    assert.ok(future && future.perToday === 2, 'back-plan splits 8 steps across 5 days as ~2/day')
    const dueToday = backPlan('2026-01-01', 3, now)
    assert.ok(dueToday && /today/.test(dueToday.message), 'due-today wording')
    const overdue = backPlan('2025-12-30', 4, now)
    assert.ok(overdue && overdue.overdueDays === 2, 'overdue is detected')
    pass('planner (next action + back-plan)')

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
    paper.content.assignment = {
      prompt: 'Analyse the causes of the war.',
      requirements: [{ id: 'req-1', text: 'Write 500 words', done: false, source: 'auto' }]
    }
    paper.content.scratch = 'messy half-formed notes that should survive a reload'
    paper.content.cards = [{ id: 'card-1', text: 'A board idea', x: 40, y: 60, color: 'blue' }]
    paper.meta.dueDate = '2026-12-01'
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
    assert.equal(reopened!.content.assignment.prompt, 'Analyse the causes of the war.')
    assert.equal(reopened!.content.assignment.requirements.length, 1)
    assert.equal(reopened!.content.assignment.requirements[0].text, 'Write 500 words')
    assert.equal(reopened!.content.scratch, 'messy half-formed notes that should survive a reload')
    assert.equal(reopened!.content.cards.length, 1, 'board cards persist')
    assert.equal(reopened!.content.cards[0].text, 'A board idea')
    assert.equal(reopened!.content.cards[0].color, 'blue')
    assert.equal(reopened!.content.cards[0].x, 40)
    assert.equal(reopened!.meta.dueDate, '2026-12-01')
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

    // --- assignment decoder ---------------------------------------------
    const decoded = decodeAssignment(
      'Write a 750-word essay in which you critically evaluate the causes of the conflict. ' +
        'Use at least 3 scholarly sources and format your citations in MLA style. ' +
        'You must include a clear thesis statement.'
    )
    assert.ok(
      decoded.commandWords.some((c) => c.term === 'critically evaluate'),
      'decoder finds the command phrase'
    )
    assert.ok(
      !decoded.commandWords.some((c) => c.term === 'evaluate'),
      'decoder drops the word contained in the longer phrase'
    )
    assert.ok(decoded.requirements.some((r) => /750/.test(r)), 'decoder finds the word count')
    assert.ok(decoded.requirements.some((r) => /at least 3 sources/i.test(r)), 'decoder finds source count')
    assert.ok(decoded.requirements.some((r) => /MLA/.test(r)), 'decoder finds citation style')
    assert.ok(decoded.requirements.some((r) => /thesis statement/i.test(r)), 'decoder finds thesis requirement')
    pass('assignment decoder')

    // --- drafting bridge: scaffold + sentence split + transitions -------
    const scaffold = outlineToDocContent(makeOutline('argument'))
    assert.ok(
      scaffold.some((n) => n.type === 'heading' && n.attrs?.level === 2),
      'scaffold turns outline steps into H2 headings'
    )
    assert.ok(scaffold.some((n) => n.type === 'blockquote'), 'scaffold includes guide blockquotes')
    const withNotes = makeOutline('argument')
    withNotes[0].text = 'My working thesis note'
    assert.ok(
      JSON.stringify(outlineToDocContent(withNotes)).includes('My working thesis note'),
      'scaffold carries outline notes into the prose'
    )

    const split = suggestSentenceSplit(
      'Recycling reduces the amount of waste that cities send to landfill and it also saves a ' +
        'great deal of energy for the whole community over time.'
    )
    assert.ok(split && /\.\s+[A-Z]/.test(split), 'long sentence split produces two sentences')
    assert.equal(suggestSentenceSplit('This is short.'), null, 'short sentences are not split')

    assert.ok(
      TRANSITIONS.length >= 4 && TRANSITIONS.every((g) => g.phrases.length > 0),
      'transition groups all have phrases'
    )
    pass('drafting bridge (scaffold + split + transitions)')

    // --- comprehension glossary -----------------------------------------
    assert.ok(
      GLOSSARY.length >= 10 && GLOSSARY.every((g) => g.term && g.definition),
      'glossary is populated with terms and definitions'
    )
    assert.ok((glossaryMap().get('thesis') ?? '').length > 0, 'glossary lookup resolves "thesis"')
    pass('comprehension glossary')

    // --- reading support (source summary) -------------------------------
    const sourceSummary = summarizeSource(
      'Climate change is altering rainfall patterns across the region. Many farmers have ' +
        'reported smaller harvests in recent years. Researchers argue that adapting crop choices ' +
        'could reduce these losses. The study collected data from two hundred farms over a decade.'
    )
    assert.ok(sourceSummary.mainClaim.length > 0, 'reading summary picks a main claim')
    assert.ok(sourceSummary.keySentences.length >= 1, 'reading summary returns key sentences')
    assert.ok(sourceSummary.wordCount > 0, 'reading summary counts words')
    assert.equal(summarizeSource('').mainClaim, '', 'empty source yields no claim')
    pass('reading support (source summary)')

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

    // --- backup round-trip ----------------------------------------------
    const bkPaper = createPaper({ title: 'Backup me', essayType: 'reflection' })
    savePaper({
      meta: bkPaper.meta,
      content: { ...bkPaper.content, scratch: 'remember this exact note' }
    })
    const bundle = buildBundle()
    assert.ok(bundle.app === 'writability' && bundle.version >= 1, 'bundle is tagged')
    assert.ok(bundle.papers.some((p) => p.meta.id === bkPaper.meta.id), 'bundle contains the paper')
    deletePaper(bkPaper.meta.id)
    assert.equal(openPaper(bkPaper.meta.id), null, 'paper is gone before restore')
    const importedCount = applyBundle(bundle)
    assert.ok(importedCount >= 1, 'applyBundle reports how many it restored')
    const restored = openPaper(bkPaper.meta.id)
    assert.ok(restored, 'paper comes back from the bundle')
    assert.equal(
      restored!.content.scratch,
      'remember this exact note',
      'restored content matches exactly'
    )
    assert.equal(
      restored!.meta.createdAt,
      bkPaper.meta.createdAt,
      'restore preserves the original timestamps'
    )
    assert.throws(() => applyBundle({} as never), 'a non-backup object is rejected')
    deletePaper(bkPaper.meta.id)
    pass('backup round-trip')

    // --- AI coach (opt-in, fully mocked — no network) -------------------
    assert.ok(isValidModel('claude-opus-4-8') && !isValidModel('nope'), 'AI model validation')
    const brainstormPrompt = buildPrompt('brainstorm', 'My topic.')
    assert.equal(brainstormPrompt.user, 'My topic.', 'prompt carries the student text')
    assert.ok(/NEVER write the essay/i.test(brainstormPrompt.system), 'coach prompt forbids ghostwriting')
    assert.ok(/structure|outline/i.test(buildPrompt('outline', 'x').system), 'outline prompt is structural')
    assert.deepEqual(splitIntoItems('- one\n- two\n* three'), ['one', 'two', 'three'], 'items split from a list')

    // With no key configured, the task short-circuits to a friendly message.
    const noKey = await runAiTask({ task: 'brainstorm', text: 'Hello.' }, async () => 'unused')
    assert.ok(!noKey.ok && /key/i.test(noKey.error ?? ''), 'no key yields a friendly error')

    // With a key + an injected completer, exercise the happy path offline.
    const baseSettings = getSettings()
    saveSettings({ ...baseSettings, aiApiKey: 'sk-test', aiModel: 'claude-haiku-4-5' })
    let seen: { model?: string; user?: string } = {}
    const good = await runAiTask({ task: 'brainstorm', text: 'climate essay' }, async (args) => {
      seen = args
      return '  - idea one\n- idea two  '
    })
    assert.ok(good.ok && good.text === '- idea one\n- idea two', 'AI success returns trimmed text')
    assert.equal(seen.model, 'claude-haiku-4-5', 'completer gets the chosen model')
    assert.ok((seen.user ?? '').includes('climate'), 'completer gets the student text')

    const unauthorized = await runAiTask({ task: 'feedback', text: 'hello' }, async () => {
      throw Object.assign(new Error('nope'), { status: 401 })
    })
    assert.ok(!unauthorized.ok && /key/i.test(unauthorized.error ?? ''), '401 maps to check-your-key')

    const blank = await runAiTask({ task: 'brainstorm', text: '   ' }, async () => 'x')
    assert.ok(!blank.ok, 'blank input is rejected before any call')
    saveSettings(baseSettings)
    pass('AI coach (opt-in, mocked)')

    // --- read-aloud sentence splitting (pure) ---------------------------
    const sents = splitSentences('Hello there. How are you?\n\nNew para! Yes.')
    assert.equal(sents.length, 4, 'splits sentences across a paragraph break')
    assert.equal(sents[0].text, 'Hello there.')
    assert.equal(sents[1].text, 'How are you?')
    assert.equal(sents[3].text, 'Yes.')
    assert.ok(sents[0].start === 0 && sents[0].end >= 12, 'sentence carries source offsets')
    const ps = splitSentences('Hello there. How are you?')
    assert.equal(sentenceIndexAt(ps, 0), 0, 'char index 0 maps to first sentence')
    assert.equal(sentenceIndexAt(ps, 14), 1, 'char index in the second maps to it')
    assert.deepEqual(splitSentences(''), [], 'empty text yields no sentences')
    assert.equal(splitSentences('A fragment with no end').length, 1, 'a fragment is one sentence')
    pass('read-aloud sentence splitting')

    // --- promote board cards into outline sections (pure) ---------------
    const baseOutline = makeOutline('argument')
    const sectionId = baseOutline[1].id // "Point 1"
    const underSection = insertNoteUnder(baseOutline, sectionId, 'remember the 1990 data')
    assert.equal(
      underSection[1].children.length,
      baseOutline[1].children.length + 1,
      'a note lands under its chosen section'
    )
    const kids = underSection[1].children
    assert.equal(kids[kids.length - 1].text, 'remember the 1990 data', 'the note carries the card text')
    assert.equal(underSection.length, baseOutline.length, 'no extra top-level node when a section is given')
    const unsorted = insertNoteUnder(baseOutline, undefined, 'loose idea')
    assert.equal(unsorted.length, baseOutline.length + 1, 'an unsorted note becomes a top-level node')
    assert.equal(unsorted[unsorted.length - 1].kind, 'note', 'promoted card is a note node')
    const unknown = insertNoteUnder(baseOutline, 'no-such-id', 'x')
    assert.equal(unknown.length, baseOutline.length + 1, 'unknown section falls back to top-level')
    pass('promote cards to outline sections')

    // --- heuristic edge cases (robustness on empty / sparse input) ------
    assert.equal(analyzeClarity('').wordCount, 0, 'empty text has zero words')
    assert.equal(analyzeClarity('').issues.length, 0, 'empty text raises no clarity flags')
    const oneLine = summarizeSource('A single clear sentence about cats.')
    assert.equal(oneLine.keySentences.length, 1, 'one-sentence source yields one key sentence')
    assert.equal(oneLine.mainClaim, 'A single clear sentence about cats.', 'main claim is that sentence')
    const sparseCite = formatCitation({ id: 'z', type: 'website', authors: [], title: 'Untitled' }, 'mla')
    assert.equal(typeof sparseCite.reference, 'string', 'a sparse citation formats without throwing')
    pass('heuristic edge cases')

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
