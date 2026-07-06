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
import { Spotlight, spotlightKey, Glossary, glossaryKey, Spellcheck, spellcheckKey, Find, findKey, findMatches } from '../lib/tiptapAddons'
import { ensureSpell, setCustomWords } from '../lib/spell'
import { outlineToDocContent } from '@shared/scaffold'
import { TRANSITIONS } from '@shared/transitions'
import { pageStats } from '@shared/format'
import { nextAction } from '@shared/planner'

// Papers whose re-entry card was dismissed this session.
const reentryDismissed = new Set<string>()

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
  const stage = current.meta.stage ?? 'polish'
  const drafting = stage === 'draft'

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
      Find
    ],
    content: current.content.doc as never,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'prose',
        'aria-label': 'Paper text',
        role: 'textbox',
        'aria-multiline': 'true'
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
      <FormatBar editor={editor} onInsertOutline={insertOutline} />
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
          <button className="ghost" data-testid="reentry-dismiss" onClick={dismissReentry}>
            Got it
          </button>
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
}

function FormatBar({ editor, onInsertOutline }: FormatBarProps): JSX.Element | null {
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
