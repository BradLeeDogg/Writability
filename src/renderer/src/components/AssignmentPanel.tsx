import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { findCommandWords } from '@shared/assignment'
import { PAPER_FORMATS } from '@shared/format'
import type { PaperFormat, PaperHeading } from '@shared/types'

export function AssignmentPanel(): JSX.Element {
  const current = useStore((s) => s.current)!
  const setPrompt = useStore((s) => s.setAssignmentPrompt)
  const setMeta = useStore((s) => s.setMeta)
  const decode = useStore((s) => s.decodeAssignment)
  const addRequirement = useStore((s) => s.addRequirement)
  const toggleRequirement = useStore((s) => s.toggleRequirement)
  const removeRequirement = useStore((s) => s.removeRequirement)

  const { prompt, requirements } = current.content.assignment
  const meta = current.meta
  const heading: PaperHeading = meta.heading ?? {}
  const setHeading = (patch: Partial<PaperHeading>): void => setMeta({ heading: { ...heading, ...patch } })
  const commandWords = useMemo(() => findCommandWords(prompt), [prompt])
  const done = requirements.filter((r) => r.done).length

  const [note, setNote] = useState('')
  const [draft, setDraft] = useState('')

  const onDecode = (): void => {
    const added = decode()
    setNote(
      added > 0
        ? `Added ${added} requirement${added === 1 ? '' : 's'} from your prompt.`
        : 'No new requirements found. You can add your own below.'
    )
  }

  const onAdd = (): void => {
    if (!draft.trim()) return
    addRequirement(draft)
    setDraft('')
  }

  return (
    <div className="assignment" data-testid="assignment-panel">
      <details className="paper-details" data-testid="paper-details">
        <summary>Paper details &amp; format</summary>
        <p className="muted small">
          Used to format your export (heading, spacing, page numbers) in the style you choose.
        </p>
        <label className="field">
          <span>Format</span>
          <select
            data-testid="meta-format"
            value={meta.format ?? 'none'}
            onChange={(e) => setMeta({ format: e.target.value as PaperFormat, pageNumbers: e.target.value !== 'none' })}
          >
            {PAPER_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Your name</span>
          <input
            data-testid="meta-name"
            value={heading.studentName ?? ''}
            onChange={(e) => setHeading({ studentName: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Course / subject</span>
          <input value={heading.course ?? ''} onChange={(e) => setHeading({ course: e.target.value })} />
        </label>
        <label className="field">
          <span>Teacher / instructor</span>
          <input value={heading.instructor ?? ''} onChange={(e) => setHeading({ instructor: e.target.value })} />
        </label>
        <label className="field">
          <span>Date</span>
          <input value={heading.date ?? ''} placeholder="e.g. 14 May 2026" onChange={(e) => setHeading({ date: e.target.value })} />
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={meta.pageNumbers ?? false}
            onChange={(e) => setMeta({ pageNumbers: e.target.checked })}
          />
          <span>Number the pages</span>
        </label>
      </details>

      <p className="panel-intro">
        Paste your assignment instructions or rubric. Writability will explain the instruction
        words in plain language and pull out a checklist of what to do — including each rubric
        criterion you’ll be graded on.
      </p>

      <textarea
        className="assignment-prompt"
        data-testid="assignment-prompt"
        value={prompt}
        rows={5}
        aria-label="Assignment prompt"
        placeholder="e.g. Write a 750-word essay in which you analyse the causes of the conflict. Use at least 3 scholarly sources in MLA style."
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button className="primary block" data-testid="decode-assignment" onClick={onDecode}>
        Break it down for me
      </button>
      {note && (
        <p className="assignment-note" role="status" aria-live="polite">
          {note}
        </p>
      )}

      {commandWords.length > 0 && (
        <section className="cmd-words">
          <h3>What these words are asking for</h3>
          <ul>
            {commandWords.map((c) => (
              <li key={c.term} className="cmd-word">
                <p className="cmd-term">{c.term}</p>
                <p className="cmd-meaning">{c.meaning}</p>
                <p className="cmd-example">Example: {c.example}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="requirements">
        <h3>
          Requirements{' '}
          {requirements.length > 0 && (
            <span className="count">
              {done} / {requirements.length} done
            </span>
          )}
        </h3>

        {requirements.length === 0 ? (
          <p className="muted">
            No requirements yet. Paste your prompt and press “Break it down for me”, or add your own.
          </p>
        ) : (
          <ul className="requirement-list">
            {requirements.map((r) => (
              <li key={r.id} className="requirement" data-testid="requirement-item">
                <label className="requirement-check">
                  <input
                    type="checkbox"
                    checked={r.done}
                    onChange={() => toggleRequirement(r.id)}
                    aria-label={`Mark "${r.text}" done`}
                  />
                  <span className={r.done ? 'requirement-text done' : 'requirement-text'}>
                    {r.text}
                  </span>
                </label>
                <button
                  className="icon danger"
                  aria-label={`Remove "${r.text}"`}
                  title="Remove"
                  onClick={() => removeRequirement(r.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="add-requirement row">
          <input
            className="grow"
            data-testid="add-requirement-input"
            value={draft}
            placeholder="Add your own requirement…"
            aria-label="Add your own requirement"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAdd()
            }}
          />
          <button className="ghost" data-testid="add-requirement" onClick={onAdd}>
            Add
          </button>
        </div>
      </section>
    </div>
  )
}
