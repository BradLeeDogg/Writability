import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { formatWhen } from '../lib/format'
import { ESSAY_TYPE_LABELS } from '@shared/types'
import type { EssayType, PaperFormat } from '@shared/types'
import { PAPER_FORMATS } from '@shared/format'

const ESSAY_TYPES: EssayType[] = ['argument', 'research', 'lab', 'thesis', 'reflection']

export function Library(): JSX.Element {
  const papers = useStore((s) => s.papers)
  const createPaper = useStore((s) => s.createPaper)
  const openPaper = useStore((s) => s.openPaper)
  const deletePaper = useStore((s) => s.deletePaper)
  const askConfirm = useStore((s) => s.askConfirm)
  const trash = useStore((s) => s.trash)
  const refreshTrash = useStore((s) => s.refreshTrash)
  const restoreFromTrash = useStore((s) => s.restoreFromTrash)
  const importPaper = useStore((s) => s.importPaper)
  const typeCountsRaw = useStore((s) => s.settings.typeCounts)
  const typeCounts = typeCountsRaw ?? {}
  const leanNudgeDismissed = useStore((s) => s.settings.leanNudgeDismissed ?? false)
  const updateSettings = useStore((s) => s.updateSettings)

  useEffect(() => {
    void refreshTrash()
  }, [refreshTrash])

  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
  const [essayType, setEssayType] = useState<EssayType>('argument')
  const [format, setFormat] = useState<PaperFormat>('mla')
  const [lean, setLean] = useState(false)

  const onCreate = async (): Promise<void> => {
    await createPaper({ title: title.trim() || 'Untitled paper', essayType, format, lean })
    setShowNew(false)
    setTitle('')
    setEssayType('argument')
    setFormat('mla')
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
        <div className="row wrap">
          <button className="primary big" data-testid="new-paper" onClick={() => setShowNew(true)}>
            + Start a new paper
          </button>
          <button className="ghost" data-testid="import-docx" onClick={() => void importPaper()}>
            Import a Word document…
          </button>
        </div>
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
          <fieldset className="field">
            <legend>Which format does it need?</legend>
            <div className="chips">
              {PAPER_FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  data-testid={`format-${f.value}`}
                  className={'chip' + (format === f.value ? ' selected' : '')}
                  aria-pressed={format === f.value}
                  title={f.blurb}
                  onClick={() => setFormat(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="muted small">{PAPER_FORMATS.find((f) => f.value === format)?.blurb}</p>
          </fieldset>

          <label className="toggle">
            <input
              type="checkbox"
              data-testid="create-lean"
              checked={lean}
              onChange={(e) => setLean(e.target.checked)}
            />
            <span>Start lean — same steps, without the writing prompts</span>
          </label>
          {!lean && !leanNudgeDismissed && (typeCounts[essayType] ?? 0) >= 3 && (
            <p className="lean-nudge" data-testid="lean-nudge">
              You’ve written {typeCounts[essayType]} of these — want to start leaner this time?{' '}
              <button className="link-btn" data-testid="lean-nudge-yes" onClick={() => setLean(true)}>
                Start lean
              </button>{' '}
              ·{' '}
              <button
                className="link-btn"
                data-testid="lean-nudge-no"
                onClick={() => updateSettings({ leanNudgeDismissed: true })}
              >
                No thanks — don’t ask again
              </button>
            </p>
          )}

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
                    void (async () => {
                      const ok = await askConfirm({
                        title: 'Delete this paper?',
                        body: `"${p.title}" will move to Recently deleted, where you can bring it back for 30 days.`,
                        confirmLabel: 'Delete',
                        danger: true
                      })
                      if (ok) {
                        await deletePaper(p.id)
                        await refreshTrash()
                      }
                    })()
                  }}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {trash.length > 0 && (
        <details className="trash-list" data-testid="trash-list">
          <summary>Recently deleted ({trash.length})</summary>
          <p className="muted small">Deleted papers stay here for 30 days.</p>
          <ul>
            {trash.map((p) => (
              <li key={p.id} className="paper-row">
                <span className="paper-title muted">{p.title}</span>
                <button
                  className="ghost"
                  data-testid={'restore-' + p.id}
                  onClick={() => void restoreFromTrash(p.id)}
                >
                  Bring back
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
