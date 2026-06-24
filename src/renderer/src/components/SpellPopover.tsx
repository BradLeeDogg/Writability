import { useEffect, useMemo } from 'react'
import { spellHelpFor } from '../lib/spell'

export interface SpellTarget {
  word: string
  from: number
  to: number
  /** Viewport coordinates of the word (its left edge / bottom). */
  left: number
  top: number
}

interface Props {
  target: SpellTarget
  onReplace: (replacement: string) => void
  onIgnore: () => void
  onClose: () => void
}

// A small, calm popover anchored under a flagged word: a few suggestions to
// pick from, an optional plain-language hint for confused words, and a way to
// say "this is fine". Deliberately not a red-squiggle scolding.
export function SpellPopover({ target, onReplace, onIgnore, onClose }: Props): JSX.Element {
  const help = useMemo(() => spellHelpFor(target.word), [target.word])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Keep the popover on-screen horizontally.
  const left = Math.max(12, Math.min(target.left, window.innerWidth - 280))
  const top = Math.min(target.top + 6, window.innerHeight - 200)

  return (
    <>
      <div className="spell-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="spell-pop"
        data-testid="spell-popover"
        role="dialog"
        aria-label={`Spelling help for ${target.word}`}
        style={{ left, top }}
      >
        <div className="spell-word">{target.word}</div>
        {help.hint && <p className="spell-hint">{help.hint}</p>}
        {help.suggestions.length > 0 ? (
          <div className="spell-suggestions">
            {help.suggestions.map((s) => (
              <button
                key={s}
                className="chip"
                data-testid="spell-suggestion"
                onClick={() => onReplace(s)}
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <p className="muted small">No suggestions — try sounding it out.</p>
        )}
        <div className="spell-actions">
          <button className="ghost" data-testid="spell-ignore" onClick={onIgnore}>
            Leave it
          </button>
        </div>
      </div>
    </>
  )
}
