import { useEffect, useReducer, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useStore } from '../store/useStore'
import { ThesisPin } from './ThesisPin'
import { SpellPopover } from './SpellPopover'
import type { SpellTarget } from './SpellPopover'
import { Spotlight, spotlightKey, Glossary, glossaryKey, Spellcheck, spellcheckKey } from '../lib/tiptapAddons'
import { ensureSpell } from '../lib/spell'
import { outlineToDocContent } from '@shared/scaffold'
import { TRANSITIONS } from '@shared/transitions'

export function Editor(): JSX.Element {
  // App only mounts the Editor when a paper is open.
  const current = useStore((s) => s.current)!
  const setDoc = useStore((s) => s.setDoc)
  const spotlightMode = useStore((s) => s.settings.spotlightMode)
  const defineTerms = useStore((s) => s.settings.defineTerms)
  const readingRuler = useStore((s) => s.settings.readingRuler)
  const spellHelp = useStore((s) => s.settings.spellHelp)
  const homophoneHelp = useStore((s) => s.settings.homophoneHelp)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing here. You can begin anywhere — the outline is here to help.'
      }),
      CharacterCount,
      Spotlight,
      Glossary,
      Spellcheck
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
    if (editor) editor.view.dispatch(editor.state.tr.setMeta(glossaryKey, defineTerms))
  }, [editor, defineTerms])

  // Spellcheck: flip the flags, and build the dictionary the first time it's
  // wanted (then nudge a recompute once it's ready).
  useEffect(() => {
    if (!editor) return
    editor.view.dispatch(
      editor.state.tr.setMeta(spellcheckKey, { enabled: spellHelp, homophones: homophoneHelp })
    )
    if (spellHelp) {
      ensureSpell(() => {
        if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(spellcheckKey, {}))
      })
    }
  }, [editor, spellHelp, homophoneHelp])

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
    setSpell({ word, from, to, left: coords.left, top: coords.bottom })
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

  const words = editor?.storage.characterCount.words() ?? 0
  const goal = current.meta.wordGoal

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
        <SpellPopover target={spell} onReplace={replaceSpell} onIgnore={ignoreSpell} onClose={() => setSpell(null)} />
      )}
      <footer className="editor-status" aria-live="polite">
        <span>
          {words} {words === 1 ? 'word' : 'words'}
          {goal ? ` of ${goal}` : ''}
        </span>
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
