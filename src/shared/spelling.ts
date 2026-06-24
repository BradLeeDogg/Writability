// Pure helpers for the gentle spelling helper. The actual dictionary lookups
// (nspell) live in the renderer; everything here is dependency-free and
// unit-tested: deciding what's worth checking, curated homophone hints, and
// tidying/casing the suggestions the dictionary returns.

/** Should this token be spell-checked at all? */
export function looksLikeWord(token: string): boolean {
  if (!/^[A-Za-z][A-Za-z'’]*$/.test(token)) return false // letters + apostrophes only
  if (token.length < 2) return false // skip "a", "I"
  if (token.length > 1 && token === token.toUpperCase()) return false // skip ACRONYMS
  return true
}

/** Normalise a word for dictionary lookup (curly apostrophes → straight). */
export function normalizeWord(word: string): string {
  return word.replace(/’/g, "'")
}

// Commonly confused words. These are spelled correctly, so the dictionary
// won't flag them — but a gentle "which one did you mean?" helps a lot.
export interface Confusable {
  words: string[]
  hint: string
}

export const CONFUSABLES: Confusable[] = [
  { words: ['their', 'there', "they're"], hint: '“their” = belongs to them · “there” = a place · “they’re” = they are' },
  { words: ['your', "you're"], hint: '“your” = belongs to you · “you’re” = you are' },
  { words: ['its', "it's"], hint: '“its” = belongs to it · “it’s” = it is' },
  { words: ['to', 'too', 'two'], hint: '“to” = toward · “too” = also/very · “two” = the number 2' },
  { words: ['then', 'than'], hint: '“then” = next, in time · “than” = used to compare' },
  { words: ['affect', 'effect'], hint: '“affect” = to change (verb) · “effect” = the result (noun)' },
  { words: ['accept', 'except'], hint: '“accept” = to receive · “except” = leaving out' },
  { words: ['lose', 'loose'], hint: '“lose” = can’t find it · “loose” = not tight' },
  { words: ['quiet', 'quite'], hint: '“quiet” = not loud · “quite” = very/fairly' },
  { words: ['weather', 'whether'], hint: '“weather” = rain/sun · “whether” = if' },
  { words: ['hear', 'here'], hint: '“hear” = with your ears · “here” = this place' },
  { words: ['threw', 'through'], hint: '“threw” = did throw · “through” = in one side and out the other' },
  { words: ['knew', 'new'], hint: '“knew” = did know · “new” = not old' },
  { words: ['write', 'right'], hint: '“write” = put words down · “right” = correct / not left' },
  { words: ['piece', 'peace'], hint: '“piece” = a part · “peace” = calm, no war' }
]

const CONFUSABLE_INDEX = new Map<string, Confusable>()
for (const group of CONFUSABLES) {
  for (const w of group.words) CONFUSABLE_INDEX.set(w.toLowerCase(), group)
}

/** If `word` is part of a confusable set, the other options and a plain hint. */
export function confusableFor(word: string): { alternatives: string[]; hint: string } | undefined {
  const group = CONFUSABLE_INDEX.get(normalizeWord(word).toLowerCase())
  if (!group) return undefined
  const lower = normalizeWord(word).toLowerCase()
  return { alternatives: group.words.filter((w) => w.toLowerCase() !== lower), hint: group.hint }
}

/**
 * Tidy the dictionary's suggestions: keep its order (already ranked by
 * likelihood), but float words sharing the first letter to the top, since
 * first-letter errors are rare. Stable for ties; capped to `max`.
 */
export function rankSuggestions(word: string, suggestions: string[], max = 5): string[] {
  const first = normalizeWord(word).toLowerCase()[0]
  return suggestions
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      const am = a.s.toLowerCase()[0] === first ? 0 : 1
      const bm = b.s.toLowerCase()[0] === first ? 0 : 1
      return am - bm || a.i - b.i
    })
    .slice(0, max)
    .map((x) => x.s)
}

/** Match a suggestion's capitalisation to the original word. */
export function applyCase(model: string, suggestion: string): string {
  if (!model || !suggestion) return suggestion
  if (model.length > 1 && model === model.toUpperCase()) return suggestion.toUpperCase()
  if (model[0] === model[0].toUpperCase()) return suggestion[0].toUpperCase() + suggestion.slice(1)
  return suggestion
}

/**
 * Add a word to a personal dictionary list: normalise to lowercase, reject
 * empty/invalid tokens, and de-duplicate (case-insensitive). Returns the same
 * list unchanged when there's nothing to add.
 */
export function mergeCustomWord(list: string[], word: string): string[] {
  const w = normalizeWord(word).trim().toLowerCase()
  if (!w || !/^[a-z][a-z'’-]*$/.test(w)) return list
  if (list.some((x) => x.toLowerCase() === w)) return list
  return [...list, w]
}
