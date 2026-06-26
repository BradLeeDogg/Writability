import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { docToPlainText, splitWords } from '@shared/doc'
import { confusableFor, looksLikeWord, normalizeWord } from '@shared/spelling'
import { ensureSpell, isMisspelled, setCustomWords, spellHelpFor, spellReady } from '../lib/spell'

interface Flagged {
  word: string
  count: number
  kind: 'spell' | 'confusable'
}

// A calm review of the whole paper's spelling in one place: each flagged word
// once (with how many times it appears), suggestions that fix every occurrence
// at once, and a way to teach the checker a word. A gentler way to tidy up at
// the end than hunting for underlines.
export function SpellingPanel(): JSX.Element {
  const doc = useStore((s) => s.current?.content.doc)
  const homophoneHelp = useStore((s) => s.settings.homophoneHelp)
  const customWords = useStore((s) => s.settings.customWords)
  const replaceWordEverywhere = useStore((s) => s.replaceWordEverywhere)
  const addCustomWord = useStore((s) => s.addCustomWord)

  const [ready, setReady] = useState(spellReady())
  useEffect(() => {
    if (!ready) ensureSpell(() => setReady(true))
  }, [ready])
  // The panel can be opened without the editor having synced the dictionary yet.
  useEffect(() => setCustomWords(customWords), [customWords])

  const flagged = useMemo<Flagged[]>(() => {
    if (!ready) return []
    const seen = new Map<string, Flagged>()
    for (const tok of splitWords(docToPlainText(doc))) {
      const w = tok.text
      if (!looksLikeWord(w)) continue
      const lower = normalizeWord(w).toLowerCase()
      const existing = seen.get(lower)
      if (existing) {
        existing.count += 1
        continue
      }
      if (isMisspelled(w)) seen.set(lower, { word: w, count: 1, kind: 'spell' })
      else if (homophoneHelp && confusableFor(w)) seen.set(lower, { word: w, count: 1, kind: 'confusable' })
    }
    return [...seen.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, ready, homophoneHelp, customWords])

  const misspellings = flagged.filter((f) => f.kind === 'spell')
  const confusables = flagged.filter((f) => f.kind === 'confusable')

  return (
    <div className="spelling-panel" data-testid="spelling-panel">
      <p className="panel-intro">
        A whole-paper spelling check. Pick a suggestion to fix every place a word appears at once —
        nothing changes until you choose.
      </p>

      {!ready && <p className="muted">Getting the dictionary ready…</p>}

      {ready && flagged.length === 0 && (
        <p className="spell-clear" data-testid="spelling-clear">
          ✓ Nothing to review right now — your spelling looks good.
        </p>
      )}

      {misspellings.map((f) => {
        const help = spellHelpFor(f.word)
        return (
          <div className="spell-row" key={'m-' + f.word} data-testid="spell-summary-row">
            <div className="spell-row-head">
              <span className="spell-row-word" data-testid="spell-summary-word">
                {f.word}
              </span>
              {f.count > 1 && <span className="spell-row-count">×{f.count}</span>}
            </div>
            <div className="spell-suggestions">
              {help.suggestions.map((s) => (
                <button
                  key={s}
                  className="chip"
                  data-testid="spell-summary-suggestion"
                  onClick={() => replaceWordEverywhere(f.word, s)}
                  title={`Replace every “${f.word}” with “${s}”`}
                >
                  {s}
                </button>
              ))}
              <button
                className="chip ghost-chip"
                data-testid="spell-summary-add"
                onClick={() => addCustomWord(f.word)}
                title="Add to my words"
              >
                + my words
              </button>
            </div>
          </div>
        )
      })}

      {confusables.length > 0 && (
        <>
          <h4 className="spell-subhead">Words to double-check</h4>
          {confusables.map((f) => {
            const help = spellHelpFor(f.word)
            return (
              <div className="spell-row" key={'c-' + f.word} data-testid="spell-summary-row">
                <div className="spell-row-head">
                  <span className="spell-row-word">{f.word}</span>
                  {f.count > 1 && <span className="spell-row-count">×{f.count}</span>}
                </div>
                {help.hint && <p className="spell-hint">{help.hint}</p>}
                <div className="spell-suggestions">
                  {help.suggestions.map((s) => (
                    <button
                      key={s}
                      className="chip"
                      data-testid="spell-summary-suggestion"
                      onClick={() => replaceWordEverywhere(f.word, s)}
                      title={`Replace every “${f.word}” with “${s}”`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
