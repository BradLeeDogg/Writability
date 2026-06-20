import { useState } from 'react'
import { useStore } from '../store/useStore'
import { formatWhen } from '../lib/format'
import { ESSAY_TYPE_LABELS } from '@shared/types'
import type { EssayType } from '@shared/types'

const ESSAY_TYPES: EssayType[] = ['argument', 'research', 'lab', 'thesis', 'reflection']

export function Library(): JSX.Element {
  const papers = useStore((s) => s.papers)
  const createPaper = useStore((s) => s.createPaper)
  const openPaper = useStore((s) => s.openPaper)
  const deletePaper = useStore((s) => s.deletePaper)

  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
  const [essayType, setEssayType] = useState<EssayType>('argument')

  const onCreate = async (): Promise<void> => {
    await createPaper({ title: title.trim() || 'Untitled paper', essayType })
    setShowNew(false)
    setTitle('')
    setEssayType('argument')
  }

  return (
    <div className="library" data-testid="library">
      <header className="library-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ✎
          </span>
          <span>Writability</span>
        </div>
        <p className="tagline">Write + ability. A calm place to write your papers.</p>
      </header>

      {!showNew ? (
        <button className="primary big" data-testid="new-paper" onClick={() => setShowNew(true)}>
          + Start a new paper
        </button>
      ) : (
        <section className="card new-paper" aria-label="Create a new paper">
          <h2>New paper</h2>
          <label className="field">
            <span>Title</span>
            <input
              autoFocus
              value={title}
              placeholder="Untitled paper"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onCreate()
              }}
            />
          </label>
          <fieldset className="field">
            <legend>What kind of paper is it?</legend>
            <div className="chips">
              {ESSAY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={'chip' + (essayType === t ? ' selected' : '')}
                  aria-pressed={essayType === t}
                  onClick={() => setEssayType(t)}
                >
                  {ESSAY_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="row">
            <button className="primary" data-testid="create-paper" onClick={() => void onCreate()}>
              Create paper
            </button>
            <button className="ghost" onClick={() => setShowNew(false)}>
              Cancel
            </button>
          </div>
        </section>
      )}

      <section className="paper-list" aria-label="Your papers">
        <h2>Your papers</h2>
        {papers.length === 0 ? (
          <p className="muted">
            No papers yet. Starting is the hardest part — make one and the outline will guide you,
            step by step.
          </p>
        ) : (
          <ul>
            {papers.map((p) => (
              <li key={p.id} className="paper-row">
                <button className="paper-open" onClick={() => void openPaper(p.id)}>
                  <span className="paper-title">{p.title}</span>
                  <span className="paper-meta">
                    {ESSAY_TYPE_LABELS[p.essayType]} · edited {formatWhen(p.updatedAt)}
                  </span>
                </button>
                <button
                  className="icon danger"
                  aria-label={'Delete ' + p.title}
                  title={'Delete ' + p.title}
                  onClick={() => {
                    if (confirm(`Delete "${p.title}"? This cannot be undone.`)) void deletePaper(p.id)
                  }}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
