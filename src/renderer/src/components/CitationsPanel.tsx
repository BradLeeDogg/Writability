import { useState } from 'react'
import { useStore } from '../store/useStore'
import { copyText } from '../lib/format'
import { CITATION_STYLE_LABELS, formatCitation } from '@shared/citations'
import { uid } from '@shared/ids'
import type { CitationSource, CitationStyle, SourceType } from '@shared/types'

const STYLES: CitationStyle[] = ['mla', 'apa', 'chicago']
const TYPES: { value: SourceType; label: string }[] = [
  { value: 'book', label: 'Book' },
  { value: 'website', label: 'Website' },
  { value: 'journal', label: 'Journal article' }
]

interface Draft {
  type: SourceType
  authors: string
  title: string
  containerTitle: string
  publisher: string
  year: string
  url: string
  accessed: string
  volume: string
  issue: string
  pages: string
}

const EMPTY: Draft = {
  type: 'book',
  authors: '',
  title: '',
  containerTitle: '',
  publisher: '',
  year: '',
  url: '',
  accessed: '',
  volume: '',
  issue: '',
  pages: ''
}

export function CitationsPanel(): JSX.Element {
  const current = useStore((s) => s.current)!
  const addSource = useStore((s) => s.addSource)
  const removeSource = useStore((s) => s.removeSource)

  const [style, setStyle] = useState<CitationStyle>('mla')
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [copied, setCopied] = useState<string | null>(null)

  const sources = current.content.sources
  const set = (patch: Partial<Draft>): void => setDraft((d) => ({ ...d, ...patch }))

  const onAdd = (): void => {
    if (!draft.title.trim()) return
    const source: CitationSource = {
      id: uid('src'),
      type: draft.type,
      authors: draft.authors
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean),
      title: draft.title.trim(),
      containerTitle: draft.containerTitle.trim() || undefined,
      publisher: draft.publisher.trim() || undefined,
      year: draft.year.trim() || undefined,
      url: draft.url.trim() || undefined,
      accessed: draft.accessed.trim() || undefined,
      volume: draft.volume.trim() || undefined,
      issue: draft.issue.trim() || undefined,
      pages: draft.pages.trim() || undefined
    }
    addSource(source)
    setDraft({ ...EMPTY, type: draft.type })
  }

  const doCopy = async (key: string, text: string): Promise<void> => {
    if (await copyText(text)) {
      setCopied(key)
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500)
    }
  }

  return (
    <div className="citations" data-testid="citations-panel">
      <div className="style-row">
        <label htmlFor="cite-style">Style</label>
        <select
          id="cite-style"
          value={style}
          onChange={(e) => setStyle(e.target.value as CitationStyle)}
        >
          {STYLES.map((s) => (
            <option key={s} value={s}>
              {CITATION_STYLE_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <section className="source-list" aria-label="Your sources">
        {sources.length === 0 ? (
          <p className="muted">No sources yet. Add one below and it will be formatted for you.</p>
        ) : (
          <ul>
            {sources.map((s) => {
              const f = formatCitation(s, style)
              return (
                <li key={s.id} className="source">
                  <p className="source-ref">{f.reference}</p>
                  <p className="source-intext">In-text: {f.inText}</p>
                  <div className="row wrap">
                    <button className="ghost small" onClick={() => void doCopy(s.id + '-ref', f.reference)}>
                      {copied === s.id + '-ref' ? 'Copied' : 'Copy reference'}
                    </button>
                    <button className="ghost small" onClick={() => void doCopy(s.id + '-in', f.inText)}>
                      {copied === s.id + '-in' ? 'Copied' : 'Copy in-text'}
                    </button>
                    <button
                      className="ghost small danger"
                      aria-label="Remove source"
                      onClick={() => removeSource(s.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="add-source card" aria-label="Add a source">
        <h3>Add a source</h3>
        <label className="field">
          <span>Type</span>
          <select value={draft.type} onChange={(e) => set({ type: e.target.value as SourceType })}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Author(s) — one per line, “Last, First”</span>
          <textarea
            rows={2}
            value={draft.authors}
            placeholder={'Smith, John\nDoe, Jane'}
            onChange={(e) => set({ authors: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Title</span>
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </label>

        {draft.type !== 'book' && (
          <label className="field">
            <span>{draft.type === 'journal' ? 'Journal name' : 'Website name'}</span>
            <input
              value={draft.containerTitle}
              onChange={(e) => set({ containerTitle: e.target.value })}
            />
          </label>
        )}

        <div className="row">
          {draft.type === 'book' && (
            <label className="field grow">
              <span>Publisher</span>
              <input value={draft.publisher} onChange={(e) => set({ publisher: e.target.value })} />
            </label>
          )}
          <label className="field grow">
            <span>Year</span>
            <input value={draft.year} onChange={(e) => set({ year: e.target.value })} />
          </label>
        </div>

        {draft.type === 'journal' && (
          <div className="row">
            <label className="field grow">
              <span>Volume</span>
              <input value={draft.volume} onChange={(e) => set({ volume: e.target.value })} />
            </label>
            <label className="field grow">
              <span>Issue</span>
              <input value={draft.issue} onChange={(e) => set({ issue: e.target.value })} />
            </label>
            <label className="field grow">
              <span>Pages</span>
              <input value={draft.pages} onChange={(e) => set({ pages: e.target.value })} />
            </label>
          </div>
        )}

        {draft.type === 'website' && (
          <>
            <label className="field">
              <span>URL</span>
              <input value={draft.url} onChange={(e) => set({ url: e.target.value })} />
            </label>
            <label className="field">
              <span>Date accessed</span>
              <input
                type="date"
                value={draft.accessed}
                onChange={(e) => set({ accessed: e.target.value })}
              />
            </label>
          </>
        )}

        <button className="primary" onClick={onAdd} disabled={!draft.title.trim()}>
          Add source
        </button>
        <p className="hint">Titles of books and journals should be italicised in your final paper.</p>
      </section>
    </div>
  )
}
