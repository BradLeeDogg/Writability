import { useState } from 'react'
import { useStore } from '../store/useStore'
import { FocusTimer } from './FocusTimer'
import { ESSAY_TYPE_LABELS } from '@shared/types'
import type { ExportFormat } from '@shared/types'

const SAVE_LABELS: Record<string, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: "Couldn't save"
}

export function Toolbar(): JSX.Element {
  const current = useStore((s) => s.current)!
  const setTitle = useStore((s) => s.setTitle)
  const closePaper = useStore((s) => s.closePaper)
  const saveState = useStore((s) => s.saveState)
  const focusMode = useStore((s) => s.settings.focusMode)
  const openReadAloud = useStore((s) => s.openReadAloud)
  const toggleFocus = useStore((s) => s.toggleFocus)
  const toggleOutline = useStore((s) => s.toggleOutline)
  const toggleTools = useStore((s) => s.toggleTools)
  const boardOpen = useStore((s) => s.boardOpen)
  const toggleBoard = useStore((s) => s.toggleBoard)
  const exportCurrent = useStore((s) => s.exportCurrent)
  const showToast = useStore((s) => s.showToast)
  const saveFails = useStore((s) => s.saveFails)
  const rescueCopy = useStore((s) => s.rescueCopy)
  const saveNow = useStore((s) => s.save)
  const setMeta = useStore((s) => s.setMeta)
  const stage = current.meta.stage ?? 'polish'

  const [exporting, setExporting] = useState(false)

  const onExport = async (format: ExportFormat): Promise<void> => {
    setExporting(true)
    try {
      const res = await exportCurrent(format)
      if (res.ok && res.path) {
        const path = res.path
        const name = path.split(/[\\/]/).pop() ?? path
        showToast(`Saved ${name}`, [
          { label: 'Open', run: () => void window.api.openFile(path) },
          { label: 'Show in folder', run: () => void window.api.revealFile(path) }
        ])
      } else if (!res.ok && !res.canceled) {
        showToast(`The export did not finish: ${res.error ?? 'unknown error'}. Nothing was lost — try again.`)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <header className="toolbar" data-testid="toolbar">
      <div className="toolbar-left">
        <button className="ghost" onClick={() => void closePaper()} aria-label="Back to your papers">
          ‹ Papers
        </button>
        <input
          className="title-input"
          value={current.meta.title}
          aria-label="Paper title"
          onChange={(e) => setTitle(e.target.value)}
        />
        <span className="essay-type">{ESSAY_TYPE_LABELS[current.meta.essayType]}</span>
        <div className="stage-toggle" role="group" aria-label="Writing stage">
          <button
            className={'stage-btn' + (stage === 'draft' ? ' active' : '')}
            data-testid="stage-draft"
            aria-pressed={stage === 'draft'}
            title="Drafting: spelling and review marks wait until you're ready"
            onClick={() => setMeta({ stage: 'draft' })}
          >
            Draft
          </button>
          <button
            className={'stage-btn' + (stage === 'polish' ? ' active' : '')}
            data-testid="stage-polish"
            aria-pressed={stage === 'polish'}
            title="Polishing: show spelling and review marks"
            onClick={() => setMeta({ stage: 'polish' })}
          >
            Polish
          </button>
        </div>
        {saveState === 'error' ? (
          <span className="save-state error" aria-live="polite">
            Not saved —{' '}
            <button className="link-btn" data-testid="save-retry" onClick={() => void saveNow()}>
              Try again
            </button>
            {saveFails >= 2 && (
              <>
                {' · '}
                <button className="link-btn" data-testid="save-rescue" onClick={() => void rescueCopy()}>
                  Save a copy…
                </button>
              </>
            )}
          </span>
        ) : (
          <span className={'save-state ' + saveState} aria-live="polite">
            {SAVE_LABELS[saveState]}
          </span>
        )}
      </div>

      <div className="toolbar-right">
        <button
          className={'ghost' + (boardOpen ? ' active' : '')}
          data-testid="board-toggle"
          aria-pressed={boardOpen}
          onClick={toggleBoard}
          title="Visual planning board"
        >
          {boardOpen ? '✍ Write' : '🧩 Board'}
        </button>

        <FocusTimer />

        <button
          className="ghost"
          data-testid="read-aloud"
          onClick={openReadAloud}
          title="Read the paper aloud, highlighting each sentence"
        >
          🔊 Read to me
        </button>

        <details className="menu">
          <summary className="ghost" aria-label="Export paper">
            {exporting ? 'Exporting…' : 'Export ▾'}
          </summary>
          <div className="menu-body" role="menu">
            <button role="menuitem" onClick={() => void onExport('docx')}>
              Word (.docx)
            </button>
            <button role="menuitem" onClick={() => void onExport('pdf')}>
              PDF (.pdf)
            </button>
            <button role="menuitem" onClick={() => void onExport('txt')}>
              Plain text (.txt)
            </button>
          </div>
        </details>

        <button
          className={'ghost' + (focusMode ? ' active' : '')}
          aria-pressed={focusMode}
          onClick={toggleFocus}
          title="Focus mode hides the side panels"
        >
          {focusMode ? 'Exit focus' : 'Focus'}
        </button>

        {!focusMode && (
          <>
            <button className="icon" onClick={toggleOutline} aria-label="Toggle outline" title="Toggle outline">
              ☰
            </button>
            <button className="icon" onClick={toggleTools} aria-label="Toggle tools" title="Toggle tools">
              ⚙
            </button>
          </>
        )}
      </div>
    </header>
  )
}
