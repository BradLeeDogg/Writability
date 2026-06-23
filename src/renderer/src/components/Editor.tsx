import { useEffect, useReducer } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useStore } from '../store/useStore'
import { ThesisPin } from './ThesisPin'
import { outlineToDocContent } from '@shared/scaffold'
import { TRANSITIONS } from '@shared/transitions'

export function Editor(): JSX.Element {
  // App only mounts the Editor when a paper is open.
  const current = useStore((s) => s.current)!
  const setDoc = useStore((s) => s.setDoc)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing here. You can begin anywhere — the outline is here to help.'
      }),
      CharacterCount
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
      <div className="editor-scroll">
        <EditorContent editor={editor} className="editor-surface" />
      </div>
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
