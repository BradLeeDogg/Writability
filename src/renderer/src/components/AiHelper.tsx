import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { AiTask } from '@shared/ai'
import { coachContext } from '@shared/coach'

const TASK_LABELS: Record<AiTask, string> = {
  brainstorm: '💡 Brainstorm ideas',
  outline: '🗂 Suggest an outline',
  feedback: '💬 Give me feedback'
}

const CHIPS: { key: keyof ReturnType<typeof coachContext>; label: string }[] = [
  { key: 'assignment', label: 'my assignment' },
  { key: 'thesis', label: 'my thesis' },
  { key: 'cards', label: 'my board ideas' },
  { key: 'draft', label: 'my draft' }
]

// Opt-in AI *coaching*, shown only when the student has added their own key.
// It helps them brainstorm, plan, and reflect — it never writes for them.
export function AiHelper(): JSX.Element {
  const aiKey = useStore((s) => s.settings.aiApiKey)
  const runAi = useStore((s) => s.runAi)
  const current = useStore((s) => s.current)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<AiTask | null>(null)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const configured = !!(aiKey && aiKey.trim())
  const ctx = current ? coachContext(current.content) : null

  // Drop one of the student's own pieces of work into the box (append, never
  // overwrite) so they don't retype it.
  const seedFrom = (value: string): void => {
    setText((prev) => (prev.trim() ? prev.trim() + '\n' + value : value))
  }

  if (!configured) {
    return (
      <section className="ai-helper-off" data-testid="ai-helper-off">
        <h3>
          AI coach <span className="ai-badge">optional</span>
        </h3>
        <p className="muted">
          Want optional help to brainstorm ideas, plan an outline, or get feedback? Add your own
          Claude API key in Settings. It coaches you — it never writes your essay. Nothing is sent
          unless you ask.
        </p>
      </section>
    )
  }

  const run = async (task: AiTask): Promise<void> => {
    const value = text.trim()
    if (!value || busy) return
    setBusy(task)
    setError('')
    setResult('')
    const res = await runAi({ task, text: value })
    setBusy(null)
    if (res.ok) setResult(res.text ?? '')
    else setError(res.error ?? 'Something went wrong.')
  }

  return (
    <section className="ai-helper" data-testid="ai-helper">
      <h3>
        AI coach <span className="ai-badge">optional</span>
      </h3>
      <p className="muted">
        For brainstorming, planning, and feedback — it gives you ideas and questions, but never
        writes your essay for you. Your text is sent to Anthropic only when you press a button.
      </p>
      {ctx && CHIPS.some((c) => ctx[c.key]) && (
        <div className="coach-chips">
          <span className="coach-chips-label">Use your work:</span>
          {CHIPS.filter((c) => ctx[c.key]).map((c) => (
            <button
              key={c.key}
              className="chip"
              data-testid={`coach-chip-${c.key}`}
              onClick={() => seedFrom(ctx[c.key])}
              title={`Add ${c.label} to the box`}
            >
              + {c.label}
            </button>
          ))}
        </div>
      )}
      <textarea
        className="ai-input"
        data-testid="ai-input"
        rows={4}
        value={text}
        placeholder="Paste your topic, thesis, or a draft you’d like help with…"
        aria-label="Text to send to the AI coach"
        onChange={(e) => setText(e.target.value)}
      />
      <div className="ai-actions">
        <button
          className="primary"
          data-testid="ai-brainstorm"
          disabled={busy !== null}
          onClick={() => void run('brainstorm')}
        >
          {busy === 'brainstorm' ? 'Thinking…' : TASK_LABELS.brainstorm}
        </button>
        <button
          className="ghost"
          data-testid="ai-outline"
          disabled={busy !== null}
          onClick={() => void run('outline')}
        >
          {busy === 'outline' ? 'Thinking…' : TASK_LABELS.outline}
        </button>
        <button
          className="ghost"
          data-testid="ai-feedback"
          disabled={busy !== null}
          onClick={() => void run('feedback')}
        >
          {busy === 'feedback' ? 'Thinking…' : TASK_LABELS.feedback}
        </button>
      </div>

      {error && (
        <p className="ai-error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="ai-result" data-testid="ai-result">
          <p className="ai-result-text">{result}</p>
          <div className="ai-result-actions">
            <button className="ghost small" onClick={() => void navigator.clipboard?.writeText(result)}>
              Copy
            </button>
            <span className="muted">Ideas to develop in your own words — not text to paste in.</span>
          </div>
        </div>
      )}
    </section>
  )
}
