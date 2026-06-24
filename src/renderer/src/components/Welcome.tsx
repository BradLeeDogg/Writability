import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'

// A gentle, skippable first-run guide. Three short, plain-language cards — no
// jargon, no pressure — shown once and re-openable from Settings.
interface Step {
  icon: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    icon: '👋',
    title: 'Welcome to Writability',
    body: 'A calm place to write papers, built for brains that work in lots of different ways. There is no rush here, and nothing you write is graded.'
  },
  {
    icon: '💾',
    title: 'Your work saves itself',
    body: 'Everything you type is saved automatically. You can close Writability any time and come back to exactly where you left off. For extra peace of mind, make a Backup from Settings to keep your own copy.'
  },
  {
    icon: '🧰',
    title: 'Tools, only when you want them',
    body: 'The outline on the left helps you plan. The tools on the right can decode an assignment, check clarity, build citations, and explain tricky words. Turn anything on or off in Settings.'
  }
]

export function Welcome(): JSX.Element {
  const dismiss = useStore((s) => s.dismissWelcome)
  const [step, setStep] = useState(0)
  const last = step === STEPS.length - 1
  const card = STEPS[step]

  const backdropRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)

  // Move focus to the primary action when the dialog opens and on each step,
  // so a keyboard or screen-reader user is never left behind the overlay.
  useEffect(() => {
    primaryRef.current?.focus()
  }, [step])

  // Modal keyboard contract: Escape closes; Tab is trapped inside the dialog.
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      dismiss()
      return
    }
    if (e.key !== 'Tab') return
    const focusables = Array.from(
      backdropRef.current?.querySelectorAll<HTMLElement>('button') ?? []
    ).filter((el) => !el.hasAttribute('disabled'))
    if (focusables.length === 0) return
    const first = focusables[0]
    const lastEl = focusables[focusables.length - 1]
    const active = document.activeElement
    if (e.shiftKey && active === first) {
      e.preventDefault()
      lastEl.focus()
    } else if (!e.shiftKey && active === lastEl) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="welcome-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Writability"
      data-testid="welcome"
      ref={backdropRef}
      onKeyDown={onKeyDown}
    >
      <div className="welcome-card">
        <div className="welcome-icon" aria-hidden="true">
          {card.icon}
        </div>
        <h2>{card.title}</h2>
        <p>{card.body}</p>

        <div className="welcome-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={'welcome-dot' + (i === step ? ' active' : '')} />
          ))}
        </div>

        <div className="welcome-actions">
          <button className="ghost" data-testid="welcome-skip" onClick={dismiss}>
            Skip
          </button>
          <div className="welcome-nav">
            {step > 0 && (
              <button className="ghost" onClick={() => setStep((n) => n - 1)}>
                Back
              </button>
            )}
            {last ? (
              <button
                className="primary"
                data-testid="welcome-done"
                ref={primaryRef}
                onClick={dismiss}
              >
                Start writing
              </button>
            ) : (
              <button
                className="primary"
                data-testid="welcome-next"
                ref={primaryRef}
                onClick={() => setStep((n) => n + 1)}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
