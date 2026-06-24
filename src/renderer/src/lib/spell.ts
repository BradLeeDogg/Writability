// Offline spell-checking with nspell + a bundled Hunspell dictionary (copied
// from the `dictionary-en` package into assets/). The dictionary is ~0.5 MB,
// so it's built once, lazily, off the critical path; until it's ready the
// editor simply shows no spelling marks.

import nspell from 'nspell'
import aff from '../assets/en.aff?raw'
import dic from '../assets/en.dic?raw'
import { applyCase, confusableFor, normalizeWord, rankSuggestions } from '@shared/spelling'

let checker: ReturnType<typeof nspell> | null = null
let building = false

export function spellReady(): boolean {
  return checker !== null
}

/** Build the dictionary once, then call onReady. Safe to call repeatedly. */
export function ensureSpell(onReady?: () => void): void {
  if (checker) {
    onReady?.()
    return
  }
  if (building) return
  building = true
  // Defer so the ~200ms parse doesn't block the interaction that triggered it.
  setTimeout(() => {
    try {
      checker = nspell(aff, dic)
    } catch {
      checker = null
    }
    building = false
    onReady?.()
  }, 0)
}

export function isMisspelled(word: string): boolean {
  if (!checker) return false
  return !checker.correct(normalizeWord(word))
}

export interface SpellHelp {
  suggestions: string[]
  hint?: string
}

/** Suggestions + an optional plain-language hint for a flagged word. */
export function spellHelpFor(word: string): SpellHelp {
  const conf = confusableFor(word)
  const norm = normalizeWord(word)
  const misspelled = checker ? !checker.correct(norm) : false
  const raw = misspelled && checker ? checker.suggest(norm) : []
  let suggestions = rankSuggestions(word, raw).map((s) => applyCase(word, s))
  if (conf) {
    const alts = conf.alternatives.map((a) => applyCase(word, a))
    suggestions = [...alts, ...suggestions.filter((s) => !alts.includes(s))]
  }
  suggestions = [...new Set(suggestions)].filter((s) => s.toLowerCase() !== norm.toLowerCase()).slice(0, 6)
  return { suggestions, hint: conf?.hint }
}
