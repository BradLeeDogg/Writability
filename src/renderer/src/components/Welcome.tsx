import { useState } from 'react'
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

  return (
    <div
      className="welcome-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Writability"
      data-testid="welcome"
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
              <button className="primary" data-testid="welcome-done" onClick={dismiss}>
                Start writing
              </button>
            ) : (
              <button
                className="primary"
                data-testid="welcome-next"
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
