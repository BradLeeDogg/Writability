import { useState } from 'react'
import { useStore } from '../store/useStore'
import { FocusTimer } from './FocusTimer'
import { speak, stopSpeaking, ttsSupported } from '../lib/tts'
import { docToPlainText } from '@shared/doc'
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
  const ttsRate = useStore((s) => s.settings.ttsRate)
  const toggleFocus = useStore((s) => s.toggleFocus)
  const toggleOutline = useStore((s) => s.toggleOutline)
  const toggleTools = useStore((s) => s.toggleTools)
  const exportCurrent = useStore((s) => s.exportCurrent)

  const [speaking, setSpeaking] = useState(false)
  const [exporting, setExporting] = useState(false)

  const onReadAloud = (): void => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    const text = docToPlainText(current.content.doc)
    const ok = speak(text, ttsRate, () => setSpeaking(false))
    setSpeaking(ok)
    if (!ok) alert('Read-aloud is not available on this device.')
  }

  const onExport = async (format: ExportFormat): Promise<void> => {
    setExporting(true)
    try {
      const res = await exportCurrent(format)
      if (!res.ok && !res.canceled) {
        alert(`Export failed: ${res.error ?? 'unknown error'}`)
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
        <span className={'save-state ' + saveState} aria-live="polite">
          {SAVE_LABELS[saveState]}
        </span>
      </div>

      <div className="toolbar-right">
        <FocusTimer />

        {ttsSupported() && (
          <button
            className={'ghost' + (speaking ? ' active' : '')}
            data-testid="read-aloud"
            aria-pressed={speaking}
            onClick={onReadAloud}
            title="Read the paper aloud"
          >
            {speaking ? '◼ Stop' : '🔊 Read aloud'}
          </button>
        )}

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
