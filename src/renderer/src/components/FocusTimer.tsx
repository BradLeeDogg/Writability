import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'

// A gentle work/break timer (a calm take on Pomodoro). No sound, no flashing —
// it just counts down and, when a session ends, shows a quiet, reassuring note
// that explicitly gives permission to stop. The work length is a saved setting.
const BREAK_MINUTES = 5
const LENGTHS = [15, 25, 45]

function fmt(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function FocusTimer(): JSX.Element {
  const workMinutes = useStore((s) => s.settings.focusTimerMinutes)
  const updateSettings = useStore((s) => s.updateSettings)

  const [mode, setMode] = useState<'work' | 'break'>('work')
  const [running, setRunning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(workMinutes * 60)
  const [note, setNote] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // While idle in a work session, follow the preferred length.
  useEffect(() => {
    if (!running && mode === 'work') setSecondsLeft(workMinutes * 60)
  }, [workMinutes, running, mode])

  // Tick once per second while running.
  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running])

  // When a session reaches zero, switch mode and leave a calm note.
  useEffect(() => {
    if (secondsLeft !== 0 || !running) return
    setRunning(false)
    if (mode === 'work') {
      setMode('break')
      setSecondsLeft(BREAK_MINUTES * 60)
      setNote(`Nice focus. Take a ${BREAK_MINUTES}-minute break — you can stop any time.`)
    } else {
      setMode('work')
      setSecondsLeft(workMinutes * 60)
      setNote('Break over. Start another session whenever you are ready.')
    }
  }, [secondsLeft, running, mode, workMinutes])

  const toggle = (): void => {
    setNote('')
    setRunning((r) => !r)
  }
  const reset = (): void => {
    setRunning(false)
    setMode('work')
    setSecondsLeft(workMinutes * 60)
    setNote('')
  }

  return (
    <div className="focus-timer" data-testid="focus-timer">
      <button
        className={'ghost small' + (running ? ' active' : '')}
        data-testid="timer-toggle"
        aria-pressed={running}
        onClick={toggle}
        title={mode === 'break' ? 'Break timer' : 'Focus timer'}
      >
        {running ? '⏸' : '▶'} {fmt(secondsLeft)}
        {mode === 'break' ? ' · break' : ''}
      </button>
      <details className="menu timer-menu">
        <summary className="icon" aria-label="Timer length and reset">
          ⏱
        </summary>
        <div className="menu-body" role="menu">
          {LENGTHS.map((m) => (
            <button
              key={m}
              role="menuitemradio"
              aria-checked={workMinutes === m}
              onClick={() => updateSettings({ focusTimerMinutes: m })}
            >
              {m} minutes{workMinutes === m ? ' ✓' : ''}
            </button>
          ))}
          <button role="menuitem" onClick={reset}>
            Reset
          </button>
        </div>
      </details>
      {note && (
        <span className="focus-timer-note" role="status" aria-live="polite">
          {note}
        </span>
      )}
    </div>
  )
}
