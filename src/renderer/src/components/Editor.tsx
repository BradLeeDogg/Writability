import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useStore } from '../store/useStore'
import { ThesisPin } from './ThesisPin'
import { SpellPopover } from './SpellPopover'
import type { SpellTarget } from './SpellPopover'
import { Spotlight, spotlightKey, Glossary, glossaryKey, Spellcheck, spellcheckKey, Find, findKey, findMatches, Footnote, Citation, relabelCitations } from '../lib/tiptapAddons'
import { ensureSpell, setCustomWords } from '../lib/spell'
import { outlineToDocContent } from '@shared/scaffold'
import { TRANSITIONS } from '@shared/transitions'
import { pageStats, citationStyleFor } from '@shared/format'
import { inTextCitation, SIGNAL_PHRASES } from '@shared/citations'
import type { CiteForm } from '@shared/citations'
import { countWords } from '@shared/doc'
import { nextAction } from '@shared/planner'

// Papers whose re-entry card was dismissed this session.
const reentryDismissed = new Set<string>()

// A paste this long probably came from a source rather than the student's own
// notes, so it is worth offering the citation. Short enough to catch a quoted
// sentence, long enough not to fire on a pasted word or title.
const PASTE_CITE_WORDS = 15

export function Editor(): JSX.Element {
  // App only mounts the Editor when a paper is open.
  const current = useStore((s) => s.current)!
  const setDoc = useStore((s) => s.setDoc)
  const spotlightMode = useStore((s) => s.settings.spotlightMode)
  const defineTerms = useStore((s) => s.settings.defineTerms)
  const readingRuler = useStore((s) => s.settings.readingRuler)
  const spellHelp = useStore((s) => s.settings.spellHelp)
  const homophoneHelp = useStore((s) => s.settings.homophoneHelp)
  const customWords = useStore((s) => s.settings.customWords)
  const addCustomWord = useStore((s) => s.addCustomWord)
  const setEditorInstance = useStore((s) => s.setEditorInstance)
  const setScratch = useStore((s) => s.setScratch)
  const showToast = useStore((s) => s.showToast)
  const updateSettings = useStore((s) => s.updateSettings)
  const stage = current.meta.stage ?? 'polish'
  const drafting = stage === 'draft'

  // Set by the paste handler below; rendered as a dismissible offer, never a modal.
  const [pasteHint, setPasteHint] = useState<string | null>(null)
  // Assigned once the flow below is defined, so the editor's key handler can
  // reach it without depending on declaration order.
  const openCiteEditRef = useRef<((pos: number, attrs: Record<string, unknown>) => void) | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          'Start writing here. You can begin anywhere — the outline is here to help. First drafts are allowed to be rough.'
      }),
      CharacterCount,
      Spotlight,
      Glossary,
      Spellcheck,
      Find,
      Footnote,
      Citation
    ],
    content: current.content.doc as never,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'prose',
        'aria-label': 'Paper text',
        role: 'textbox',
        'aria-multiline': 'true'
      },
      // Pasting a chunk of text is the most common way source material ends up
      // uncited by accident. Offer the citation right then — never block the
      // paste, and never nag if the student has said no.
      handlePaste: (_view, event) => {
        const pasted = event.clipboardData?.getData('text/plain') ?? ''
        if (
          countWords(pasted) >= PASTE_CITE_WORDS &&
          useStore.getState().settings.pasteCitePrompt !== false
        ) {
          setPasteHint(pasted.replace(/\s+/g, ' ').trim().slice(0, 140))
        }
        return false
      },
      // Arrowing onto a citation selects it; Enter then opens it for correction,
      // so a marker can be fixed without a mouse.
      handleKeyDown: (view, event) => {
        if (event.key !== 'Enter') return false
        const sel = view.state.selection as { node?: { type: { name: string }; attrs: Record<string, unknown> } }
        if (sel.node?.type.name !== 'citation') return false
        event.preventDefault()
        openCiteEditRef.current?.(view.state.selection.from, sel.node.attrs)
        return true
      }
    },
    onUpdate: ({ editor: ed }) => setDoc(ed.getJSON())
  })

  // Keep the formatting toolbar's active states and the word count in sync.
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (!editor) return
    const update = (): void => force()
    editor.on('transaction', update)
    return () => {
      editor.off('transaction', update)
    }
  }, [editor])

  // Flip the spotlight / glossary plugins on or off when their settings change.
  useEffect(() => {
    if (editor) editor.view.dispatch(editor.state.tr.setMeta(spotlightKey, spotlightMode))
  }, [editor, spotlightMode])
  useEffect(() => {
    if (editor) editor.view.dispatch(editor.state.tr.setMeta(glossaryKey, defineTerms && !drafting))
  }, [editor, defineTerms, drafting])

  // Spellcheck: flip the flags, and build the dictionary the first time it's
  // wanted (then nudge a recompute once it's ready).
  useEffect(() => {
    if (!editor) return
    editor.view.dispatch(
      editor.state.tr.setMeta(spellcheckKey, {
        enabled: spellHelp && !drafting,
        homophones: homophoneHelp && !drafting
      })
    )
    if (spellHelp) {
      ensureSpell(() => {
        if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(spellcheckKey, {}))
      })
    }
  }, [editor, spellHelp, homophoneHelp, drafting])

  // Keep the spell engine's personal dictionary in sync, and re-scan when it
  // changes so newly-taught words lose their underline.
  useEffect(() => {
    setCustomWords(customWords)
    if (editor) editor.view.dispatch(editor.state.tr.setMeta(spellcheckKey, { bump: true }))
  }, [editor, customWords])

  // Expose the editor so panels (e.g. Spelling) can act on the document.
  useEffect(() => {
    setEditorInstance(editor ?? null)
    return () => setEditorInstance(null)
  }, [editor, setEditorInstance])

  // Clicking a spelling mark opens the fix popover. Delegated from the page so
  // it works without ProseMirror's own click plumbing.
  const [spell, setSpell] = useState<SpellTarget | null>(null)
  const onProseClick = (e: React.MouseEvent): void => {
    if (!editor) return
    const fn = (e.target as HTMLElement).closest('sup.fn-ref') as HTMLElement | null
    if (fn) {
      const pos = editor.view.posAtDOM(fn, 0) - 1
      openFootnote(pos, fn.getAttribute('data-footnote') ?? '')
      return
    }
    const citeEl = (e.target as HTMLElement).closest('span.cite-ref') as HTMLElement | null
    if (citeEl) {
      // Match the rendered element back to its node exactly — the marker has a
      // text child, so position arithmetic off the DOM is not reliable here.
      let citePos = -1
      let citeAttrs: Record<string, unknown> = {}
      editor.state.doc.descendants((node, pos) => {
        if (citePos !== -1) return false
        if (node.type.name === 'citation' && editor.view.nodeDOM(pos) === citeEl) {
          citePos = pos
          citeAttrs = node.attrs
          return false
        }
        return undefined
      })
      if (citePos !== -1) openCiteEdit(citePos, citeAttrs)
      return
    }
    const el = (e.target as HTMLElement).closest('.pm-misspelled, .pm-confusable') as HTMLElement | null
    if (!el) {
      setSpell(null)
      return
    }
    const word = el.textContent ?? ''
    const dom = el.firstChild ?? el
    const from = editor.view.posAtDOM(dom, 0)
    const to = from + word.length
    const coords = editor.view.coordsAtPos(from)
    const kind = el.classList.contains('pm-confusable') ? 'confusable' : 'spell'
    setSpell({ word, from, to, kind, left: coords.left, top: coords.bottom })
  }
  const replaceSpell = (replacement: string): void => {
    if (!editor || !spell) return
    const current = editor.state.doc.textBetween(spell.from, spell.to)
    if (current === spell.word) {
      editor.chain().focus().insertContentAt({ from: spell.from, to: spell.to }, replacement).run()
    }
    setSpell(null)
  }
  const ignoreSpell = (): void => {
    if (editor && spell) editor.view.dispatch(editor.state.tr.setMeta(spellcheckKey, { ignore: spell.word }))
    setSpell(null)
  }
  const teachSpell = (): void => {
    if (spell) addCustomWord(spell.word)
    setSpell(null)
  }

  // Reading ruler: a tinted band that follows the pointer down the page to
  // help the eye hold its line. Lives in the scroll container and ignores
  // pointer events so it never gets in the way of writing.
  const scrollRef = useRef<HTMLDivElement>(null)
  const [rulerTop, setRulerTop] = useState<number | null>(null)
  useEffect(() => {
    if (!readingRuler) setRulerTop(null)
  }, [readingRuler])
  const onRulerMove = (e: React.MouseEvent): void => {
    if (!readingRuler) return
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setRulerTop(e.clientY - rect.top + el.scrollTop)
  }

  // Re-entry: after 48+ hours away, one dismissible "welcome back" card that
  // says where you were and the next small step. Never guilt, never a modal.
  const [showReentry, setShowReentry] = useState(() => {
    if (reentryDismissed.has(current.meta.id)) return false
    const away = Date.now() - Date.parse(current.meta.updatedAt)
    return away > 48 * 60 * 60 * 1000
  })
  const reentryStep = useMemo(() => nextAction(current.content.outline), [current.content.outline])
  const scratchNote = (current.content.scratch || '').split('\n').find((l) => l.trim()) ?? ''
  const dismissReentry = (): void => {
    reentryDismissed.add(current.meta.id)
    setShowReentry(false)
  }
  const takeMeThere = (): void => {
    if (!editor) return
    const size = editor.state.doc.content.size
    const pos = Math.max(1, Math.min(current.meta.lastCursor ?? size, size))
    editor.chain().focus().setTextSelection(pos).scrollIntoView().run()
    dismissReentry()
  }

  // Quick capture: Ctrl/Cmd+J banks a fleeting thought to Brain dump without
  // leaving the page or losing the cursor.
  const [captureOpen, setCaptureOpen] = useState(false)
  const [captureText, setCaptureText] = useState('')
  const captureRef = useRef<HTMLInputElement>(null)
  const openCapture = (): void => {
    setCaptureOpen(true)
    setTimeout(() => captureRef.current?.focus(), 0)
  }
  const saveCapture = (): void => {
    const text = captureText.trim()
    if (text) {
      const cur = useStore.getState().current
      const prev = cur?.content.scratch ?? ''
      setScratch(prev ? prev + '\n– ' + text : '– ' + text)
      showToast('Saved to Brain dump.')
    }
    setCaptureText('')
    setCaptureOpen(false)
    editor?.commands.focus()
  }

  // Footnotes: an inline bar to write the note; clicking a marker re-opens it.
  const [fnOpen, setFnOpen] = useState(false)
  const [fnText, setFnText] = useState('')
  const [fnEditPos, setFnEditPos] = useState<number | null>(null)
  const fnRef = useRef<HTMLInputElement>(null)
  const openFootnote = (pos: number | null, existing: string): void => {
    setFnEditPos(pos)
    setFnText(existing)
    setFnOpen(true)
    setTimeout(() => fnRef.current?.focus(), 0)
  }
  const saveFootnote = (): void => {
    if (!editor) return
    const text = fnText.trim()
    if (fnEditPos !== null) {
      // Editing an existing marker: empty text removes it.
      const chain = editor.chain().focus()
      if (text) chain.command(({ tr }) => {
        tr.setNodeMarkup(fnEditPos, undefined, { text })
        return true
      })
      else chain.deleteRange({ from: fnEditPos, to: fnEditPos + 1 })
      chain.run()
    } else if (text) {
      editor.chain().focus().insertContent({ type: 'footnote', attrs: { text } }).run()
    }
    setFnOpen(false)
    setFnText('')
    setFnEditPos(null)
  }

  // Insert-citation flow (the Cite button, or Ctrl/Cmd+Shift+C). Two small
  // steps, one question each: *which source*, then *which page and how should
  // it read*. The marker goes in as an object, so it can be corrected later by
  // clicking it rather than by editing text inside brackets.
  const sources = current.content.sources
  const [citeOpen, setCiteOpen] = useState(false)
  const [citeStep, setCiteStep] = useState<'pick' | 'details'>('pick')
  const [citeQuery, setCiteQuery] = useState('')
  const [citeActive, setCiteActive] = useState(0)
  const [citeSourceId, setCiteSourceId] = useState('')
  const [citePage, setCitePage] = useState('')
  const [citeForm, setCiteForm] = useState<CiteForm>('parenthetical')
  const [citeFrame, setCiteFrame] = useState(-1)
  const [citeEditPos, setCiteEditPos] = useState<number | null>(null)
  const citeRef = useRef<HTMLInputElement>(null)
  const citePageRef = useRef<HTMLInputElement>(null)
  const citeStyle = citationStyleFor(current.meta.format ?? 'none')
  const citeMatches = useMemo(() => {
    const q = citeQuery.trim().toLowerCase()
    if (!q) return sources
    return sources.filter((src) =>
      [src.title, src.authors.join(' '), src.year ?? ''].join(' ').toLowerCase().includes(q)
    )
  }, [sources, citeQuery])

  const citeSource = sources.find((s) => s.id === citeSourceId) ?? null
  const citePreview = citeSource
    ? inTextCitation(citeSource, citeStyle, { page: citePage, form: citeForm })
    : ''

  const closeCite = (): void => {
    setCiteOpen(false)
    setCiteEditPos(null)
    setCiteFrame(-1)
    editor?.commands.focus()
  }

  const openCite = (): void => {
    setCiteOpen(true)
    setCiteStep('pick')
    setCiteQuery('')
    setCiteActive(0)
    setCiteSourceId('')
    setCitePage('')
    setCiteForm('parenthetical')
    setCiteFrame(-1)
    setCiteEditPos(null)
    setTimeout(() => citeRef.current?.focus(), 0)
  }

  /** Clicking an existing marker reopens the flow on its details step. */
  const openCiteEdit = (pos: number, attrs: Record<string, unknown>): void => {
    setCiteOpen(true)
    setCiteStep('details')
    setCiteEditPos(pos)
    setCiteSourceId((attrs.sourceId as string) ?? '')
    setCitePage((attrs.page as string) ?? '')
    setCiteForm(((attrs.form as CiteForm) ?? 'parenthetical') as CiteForm)
    setCiteFrame(-1)
    setTimeout(() => citePageRef.current?.focus(), 0)
  }
  openCiteEditRef.current = openCiteEdit

  const chooseSource = (idx: number): void => {
    const src = citeMatches[idx]
    if (!src) return
    setCiteSourceId(src.id)
    setCiteStep('details')
    setTimeout(() => citePageRef.current?.focus(), 0)
  }

  const commitCite = (): void => {
    if (!editor || !citeSource) return
    const label = inTextCitation(citeSource, citeStyle, { page: citePage, form: citeForm })
    const attrs = { sourceId: citeSource.id, page: citePage.trim(), form: citeForm, label }
    if (citeEditPos !== null) {
      const pos = citeEditPos
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.setNodeMarkup(pos, undefined, attrs)
          return true
        })
        .run()
    } else {
      const frame = citeForm === 'narrative' && citeFrame >= 0 ? SIGNAL_PHRASES[citeFrame] : null
      const content: Record<string, unknown>[] = []
      if (frame?.before) content.push({ type: 'text', text: frame.before })
      content.push({ type: 'citation', attrs })
      content.push({ type: 'text', text: frame ? frame.after : ' ' })
      editor.chain().focus().insertContent(content).run()
    }
    closeCite()
  }

  const removeCite = (): void => {
    if (editor && citeEditPos !== null) {
      editor.chain().focus().deleteRange({ from: citeEditPos, to: citeEditPos + 1 }).run()
    }
    closeCite()
  }

  // The command palette can start the same flow, so citing is reachable by
  // keyboard without having to remember a three-key chord.
  const citeRequests = useStore((s) => s.citeRequests)
  const seenCiteRequest = useRef(citeRequests)
  useEffect(() => {
    // Only a *new* request opens the flow — reopening a paper must not.
    if (citeRequests === seenCiteRequest.current) return
    seenCiteRequest.current = citeRequests
    openCite()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citeRequests])

  // Keep every marker's text in step with the paper's style and its source, so
  // switching MLA -> APA (or fixing a typo in an author's name) updates the
  // whole paper instead of leaving stale brackets behind.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const byId = new Map(sources.map((s) => [s.id, s]))
    const updates = relabelCitations(editor.state.doc, (a) => {
      const src = byId.get(a.sourceId)
      return src ? inTextCitation(src, citeStyle, { page: a.page, form: a.form as CiteForm }) : null
    })
    if (!updates.length) return
    const tr = editor.state.tr
    for (const u of updates) {
      const node = editor.state.doc.nodeAt(u.pos)
      if (node) tr.setNodeMarkup(u.pos, undefined, { ...node.attrs, label: u.label })
    }
    editor.view.dispatch(tr)
  }, [editor, sources, citeStyle])

  // Find & replace: Ctrl/Cmd+F opens a small inline bar; Esc closes it.
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findActive, setFindActive] = useState(0)
  const [replaceWith, setReplaceWith] = useState('')
  const findInputRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => {
    if (!editor || !findQuery) return []
    return findMatches(editor.state.doc, findQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, findQuery, editor?.state.doc])

  const syncFind = (query: string, active: number): void => {
    if (!editor) return
    editor.view.dispatch(editor.state.tr.setMeta(findKey, { query, active }))
  }

  const gotoMatch = (index: number): void => {
    if (!editor || matches.length === 0) return
    const i = ((index % matches.length) + matches.length) % matches.length
    setFindActive(i)
    syncFind(findQuery, i)
    const dom = editor.view.domAtPos(matches[i].from).node
    const el = dom.nodeType === 3 ? dom.parentElement : (dom as HTMLElement)
    el?.scrollIntoView({ block: 'center' })
  }

  const openFind = (): void => {
    setFindOpen(true)
    setTimeout(() => findInputRef.current?.focus(), 0)
  }

  const closeFind = (): void => {
    setFindOpen(false)
    setFindQuery('')
    setFindActive(0)
    syncFind('', 0)
    editor?.commands.focus()
  }

  const replaceCurrent = (): void => {
    if (!editor || matches.length === 0) return
    const m = matches[Math.min(findActive, matches.length - 1)]
    editor.chain().focus().insertContentAt({ from: m.from, to: m.to }, replaceWith).run()
  }

  const replaceAll = (): void => {
    if (!editor || matches.length === 0) return
    const chain = editor.chain().focus()
    for (const m of [...matches].reverse()) chain.insertContentAt({ from: m.from, to: m.to }, replaceWith)
    chain.run()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        openFind()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        openCapture()
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        openCite()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const words = editor?.storage.characterCount.words() ?? 0
  const goal = current.meta.wordGoal
  const { pages, wordsToNextPage } = pageStats(words)

  const insertOutline = (): void => {
    if (!editor) return
    const content = outlineToDocContent(current.content.outline)
    if (!content.length) return
    editor.chain().focus().insertContentAt(editor.state.doc.content.size, content).run()
  }

  return (
    <section className="editor-wrap" data-testid="editor" aria-label="Writing area">
      <ThesisPin />
      <FormatBar
        editor={editor}
        onInsertOutline={insertOutline}
        onFootnote={() => openFootnote(null, '')}
        onCite={openCite}
      />
      {showReentry && (
        <div className="reentry-card" data-testid="reentry-card">
          <div className="reentry-body">
            <p className="reentry-title">Welcome back.</p>
            {reentryStep && (
              <p className="reentry-line">
                Your next small step: <strong>{reentryStep.label}</strong>
              </p>
            )}
            {scratchNote && (
              <p className="reentry-line muted">Your note to yourself: “{scratchNote}”</p>
            )}
          </div>
          <div className="reentry-actions">
            <button className="primary" data-testid="reentry-jump" onClick={takeMeThere}>
              Take me there
            </button>
            <button className="ghost" data-testid="reentry-dismiss" onClick={dismissReentry}>
              Got it
            </button>
          </div>
        </div>
      )}
      {pasteHint && (
        <div className="capture-bar paste-cite-bar" data-testid="paste-cite-bar">
          <span className="paste-cite-text">
            That looks like it came from somewhere. Add the citation now, while you remember?
          </span>
          <button
            className="primary small"
            data-testid="paste-cite-add"
            onClick={() => {
              setPasteHint(null)
              openCite()
            }}
          >
            Add a citation
          </button>
          <button className="ghost small" data-testid="paste-cite-later" onClick={() => setPasteHint(null)}>
            Not now
          </button>
          <button
            className="link-btn small"
            data-testid="paste-cite-never"
            onClick={() => {
              void updateSettings({ pasteCitePrompt: false })
              setPasteHint(null)
            }}
          >
            Don’t ask again
          </button>
        </div>
      )}
      {citeOpen && (
        <div className="capture-bar cite-bar" data-testid="cite-popover">
          {citeStep === 'pick' ? (
            <>
              <input
                ref={citeRef}
                data-testid="cite-input"
                value={citeQuery}
                placeholder="Which source is this? Type an author, title, or year…"
                aria-label="Find a source to cite"
                onChange={(e) => {
                  setCiteQuery(e.target.value)
                  setCiteActive(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeCite()
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setCiteActive((a) => Math.min(a + 1, citeMatches.length - 1))
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setCiteActive((a) => Math.max(a - 1, 0))
                  }
                  if (e.key === 'Enter') chooseSource(citeActive)
                }}
              />
              {citeMatches.length === 0 ? (
                <span className="muted small" data-testid="cite-empty">
                  No sources yet — add them in the Citations tab.
                </span>
              ) : (
                <div className="cite-options">
                  {citeMatches.slice(0, 6).map((src, i) => (
                    <button
                      key={src.id}
                      className={'chip' + (i === citeActive ? ' selected' : '')}
                      data-testid="cite-option"
                      onMouseEnter={() => setCiteActive(i)}
                      onClick={() => chooseSource(i)}
                    >
                      {inTextCitation(src, citeStyle)}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="cite-details" data-testid="cite-details">
              <label className="field cite-page-field">
                <span>Which page is it on?</span>
                <input
                  ref={citePageRef}
                  data-testid="cite-page"
                  value={citePage}
                  placeholder="e.g. 42 — leave blank if there isn’t one"
                  aria-label="Page number for this citation"
                  onChange={(e) => setCitePage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') closeCite()
                    if (e.key === 'Enter') commitCite()
                  }}
                />
              </label>

              <fieldset className="field cite-form-field">
                <legend>How should it read?</legend>
                <div className="chips">
                  <button
                    type="button"
                    data-testid="cite-form-parenthetical"
                    className={'chip' + (citeForm === 'parenthetical' ? ' selected' : '')}
                    aria-pressed={citeForm === 'parenthetical'}
                    onClick={() => setCiteForm('parenthetical')}
                  >
                    In brackets
                  </button>
                  <button
                    type="button"
                    data-testid="cite-form-narrative"
                    className={'chip' + (citeForm === 'narrative' ? ' selected' : '')}
                    aria-pressed={citeForm === 'narrative'}
                    onClick={() => setCiteForm('narrative')}
                  >
                    In your sentence
                  </button>
                </div>
              </fieldset>

              {citeForm === 'narrative' && citeEditPos === null && (
                <fieldset className="field cite-frame-field">
                  <legend>Start the sentence for me (optional)</legend>
                  <div className="chips">
                    <button
                      type="button"
                      className={'chip' + (citeFrame === -1 ? ' selected' : '')}
                      aria-pressed={citeFrame === -1}
                      onClick={() => setCiteFrame(-1)}
                    >
                      No thanks
                    </button>
                    {SIGNAL_PHRASES.map((p, i) => (
                      <button
                        key={p.label}
                        type="button"
                        data-testid="cite-frame"
                        className={'chip' + (citeFrame === i ? ' selected' : '')}
                        aria-pressed={citeFrame === i}
                        onClick={() => setCiteFrame(i)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <p className="cite-preview" data-testid="cite-preview">
                <span className="muted small">This goes in:</span>{' '}
                <span className="cite-preview-text">
                  {citeForm === 'narrative' && citeFrame >= 0 && citeEditPos === null
                    ? `${SIGNAL_PHRASES[citeFrame].before}${citePreview}${SIGNAL_PHRASES[citeFrame].after}…`
                    : citePreview}
                </span>
              </p>

              <div className="row wrap">
                <button className="primary" data-testid="cite-insert" onClick={commitCite}>
                  {citeEditPos === null ? 'Put it in' : 'Update it'}
                </button>
                {citeEditPos === null ? (
                  <button className="ghost" data-testid="cite-back" onClick={() => setCiteStep('pick')}>
                    ← Different source
                  </button>
                ) : (
                  <button className="ghost danger" data-testid="cite-remove" onClick={removeCite}>
                    Remove it
                  </button>
                )}
                <button className="ghost" onClick={closeCite}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {fnOpen && (
        <div className="capture-bar" data-testid="footnote-bar">
          <input
            ref={fnRef}
            data-testid="footnote-input"
            value={fnText}
            placeholder={fnEditPos !== null ? 'Edit the note — empty removes it…' : 'Footnote text…'}
            aria-label="Footnote text"
            onChange={(e) => setFnText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveFootnote()
              if (e.key === 'Escape') {
                setFnOpen(false)
                setFnText('')
                setFnEditPos(null)
                editor?.commands.focus()
              }
            }}
          />
        </div>
      )}
      {captureOpen && (
        <div className="capture-bar" data-testid="capture-bar">
          <input
            ref={captureRef}
            data-testid="capture-input"
            value={captureText}
            placeholder="A thought to keep for later — saved to Brain dump…"
            aria-label="Quick note to Brain dump"
            onChange={(e) => setCaptureText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveCapture()
              if (e.key === 'Escape') {
                setCaptureOpen(false)
                setCaptureText('')
                editor?.commands.focus()
              }
            }}
          />
        </div>
      )}
      {findOpen && (
        <div className="find-bar" data-testid="find-bar" role="search" aria-label="Find in paper">
          <input
            ref={findInputRef}
            data-testid="find-input"
            value={findQuery}
            placeholder="Find in this paper…"
            aria-label="Find text"
            onChange={(e) => {
              setFindQuery(e.target.value)
              setFindActive(0)
              syncFind(e.target.value, 0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') gotoMatch(e.shiftKey ? findActive - 1 : findActive + (findQuery ? 1 : 0))
              if (e.key === 'Escape') closeFind()
            }}
          />
          <span className="find-count" data-testid="find-count" aria-live="polite">
            {findQuery ? (matches.length ? `${Math.min(findActive + 1, matches.length)} of ${matches.length}` : 'No matches') : ''}
          </span>
          <button className="icon" aria-label="Previous match" onClick={() => gotoMatch(findActive - 1)}>
            ↑
          </button>
          <button className="icon" aria-label="Next match" data-testid="find-next" onClick={() => gotoMatch(findActive + 1)}>
            ↓
          </button>
          <details className="find-replace">
            <summary>Replace…</summary>
            <div className="find-replace-row">
              <input
                data-testid="replace-input"
                value={replaceWith}
                placeholder="Replace with…"
                aria-label="Replacement text"
                onChange={(e) => setReplaceWith(e.target.value)}
              />
              <button className="ghost" data-testid="replace-one" onClick={replaceCurrent}>
                Replace
              </button>
              <button className="ghost" data-testid="replace-all" onClick={replaceAll}>
                All
              </button>
            </div>
          </details>
          <button className="icon" aria-label="Close find" data-testid="find-close" onClick={closeFind}>
            ×
          </button>
        </div>
      )}
      <div
        className="editor-scroll"
        ref={scrollRef}
        onMouseMove={onRulerMove}
        onMouseLeave={() => setRulerTop(null)}
        onClick={onProseClick}
      >
        {readingRuler && rulerTop !== null && (
          <div
            className="reading-ruler"
            data-testid="reading-ruler"
            style={{ top: rulerTop }}
            aria-hidden="true"
          />
        )}
        <EditorContent
          editor={editor}
          className={'editor-surface' + (spotlightMode ? ' spotlight' : '')}
        />
      </div>
      {spell && (
        <SpellPopover
          target={spell}
          onReplace={replaceSpell}
          onIgnore={ignoreSpell}
          onTeach={teachSpell}
          onClose={() => setSpell(null)}
        />
      )}
      <footer className="editor-status" aria-live="polite">
        <span>
          {words} {words === 1 ? 'word' : 'words'}
          {goal ? ` of ${goal}` : ''}
        </span>
        {words > 0 && (
          <span className="status-pages" data-testid="page-count">
            ≈ {pages} {pages === 1 ? 'page' : 'pages'}
            {wordsToNextPage > 0 && (
              <span className="status-sub"> · ~{wordsToNextPage} to fill this page</span>
            )}
          </span>
        )}
      </footer>
    </section>
  )
}

interface FormatBarProps {
  editor: TiptapEditor | null
  onInsertOutline: () => void
  onFootnote: () => void
  onCite: () => void
}

function FormatBar({ editor, onInsertOutline, onFootnote, onCite }: FormatBarProps): JSX.Element | null {
  if (!editor) return null

  const insertPhrase = (phrase: string): void => {
    editor.chain().focus().insertContent(phrase + ' ').run()
  }
  const btn = (
    label: string,
    title: string,
    active: boolean,
    run: () => void
  ): JSX.Element => (
    <button
      type="button"
      className={'fmt' + (active ? ' active' : '')}
      aria-pressed={active}
      aria-label={title}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {label}
    </button>
  )

  return (
    <div className="format-bar" role="toolbar" aria-label="Text formatting">
      {btn('B', 'Bold', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
      {btn('I', 'Italic', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
      <span className="fmt-sep" aria-hidden="true" />
      {btn('H2', 'Heading', editor.isActive('heading', { level: 2 }), () =>
        editor.chain().focus().toggleHeading({ level: 2 }).run()
      )}
      {btn('H3', 'Subheading', editor.isActive('heading', { level: 3 }), () =>
        editor.chain().focus().toggleHeading({ level: 3 }).run()
      )}
      <span className="fmt-sep" aria-hidden="true" />
      {btn('• List', 'Bullet list', editor.isActive('bulletList'), () =>
        editor.chain().focus().toggleBulletList().run()
      )}
      {btn('1. List', 'Numbered list', editor.isActive('orderedList'), () =>
        editor.chain().focus().toggleOrderedList().run()
      )}
      {btn('❝', 'Quote', editor.isActive('blockquote'), () =>
        editor.chain().focus().toggleBlockquote().run()
      )}

      <span className="fmt-sep" aria-hidden="true" />

      <details className="menu linking-menu">
        <summary className="fmt" data-testid="linking-words" aria-label="Insert a linking word">
          Linking words ▾
        </summary>
        <div className="menu-body linking-body" role="menu">
          {TRANSITIONS.map((group) => (
            <div className="linking-group" key={group.label}>
              <p className="linking-label">{group.label}</p>
              <div className="linking-phrases">
                {group.phrases.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="menuitem"
                    className="chip"
                    data-testid="transition-phrase"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insertPhrase(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      <button
        type="button"
        className="fmt"
        data-testid="add-citation"
        title="Cite a source at the cursor (Ctrl+Shift+C)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onCite}
      >
        ❞ Cite
      </button>

      <button
        type="button"
        className="fmt"
        data-testid="add-footnote"
        title="Add a footnote at the cursor"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onFootnote}
      >
        ¹ Footnote
      </button>

      <button
        type="button"
        className="fmt insert-outline"
        data-testid="insert-outline"
        title="Insert your outline into the paper as headings"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onInsertOutline}
      >
        ⤓ Insert outline
      </button>
    </div>
  )
}
