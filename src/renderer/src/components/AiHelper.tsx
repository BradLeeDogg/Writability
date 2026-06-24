import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { AiTask } from '@shared/ai'

// Opt-in AI help, shown only when the student has added their own key in
// Settings. Their text is sent to Anthropic *only* when they press a button.
export function AiHelper(): JSX.Element {
  const aiKey = useStore((s) => s.settings.aiApiKey)
  const runAi = useStore((s) => s.runAi)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<AiTask | null>(null)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const configured = !!(aiKey && aiKey.trim())

  if (!configured) {
    return (
      <section className="ai-helper-off" data-testid="ai-helper-off">
        <h3>AI help <span className="ai-badge">optional</span></h3>
        <p className="muted">
          Want optional help to reword a tricky sentence or check your tone? Add your own Claude API
          key in Settings. Nothing is ever sent unless you ask.
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
      <h3>AI help <span className="ai-badge">optional</span></h3>
      <p className="muted">
        Paste a sentence or short paragraph you’re stuck on. It’s sent to Anthropic only when you
        press a button.
      </p>
      <textarea
        className="ai-input"
        data-testid="ai-input"
        rows={4}
        value={text}
        placeholder="Paste a sentence you’d like help with…"
        aria-label="Text to send for AI help"
        onChange={(e) => setText(e.target.value)}
      />
      <div className="ai-actions">
        <button
          className="primary"
          data-testid="ai-paraphrase"
          disabled={busy !== null}
          onClick={() => void run('paraphrase')}
        >
          {busy === 'paraphrase' ? 'Thinking…' : '✨ Make this clearer'}
        </button>
        <button
          className="ghost"
          data-testid="ai-tone"
          disabled={busy !== null}
          onClick={() => void run('tone')}
        >
          {busy === 'tone' ? 'Thinking…' : 'Check the tone'}
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
            <span className="muted">AI can make mistakes — read it over and keep your own voice.</span>
          </div>
        </div>
      )}
    </section>
  )
}
