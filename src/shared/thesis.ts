// On-thesis check — a gentle, offline "does this point connect to your thesis?"
// nudge.
//
// Staying on the thesis (and not drifting into a tangent or a deep dive on a
// favourite side-topic) is a common difficulty. This is deliberately soft: it
// only speaks up when a paragraph that already has some writing shares *no*
// meaningful words with the thesis, and it always frames the result as a
// question, never a correction. No AI, no network.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'so', 'because', 'as',
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'into', 'over',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'this', 'that',
  'these', 'those', 'it', 'its', 'they', 'them', 'their', 'there', 'here',
  'i', 'you', 'he', 'she', 'we', 'his', 'her', 'our', 'your', 'my', 'me',
  'not', 'no', 'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would',
  'can', 'could', 'should', 'may', 'might', 'must', 'from', 'than', 'too',
  'very', 'just', 'also', 'which', 'who', 'what', 'when', 'where', 'how',
  'will', 'show', 'because', 'one', 'main', 'idea', 'point', 'reason'
])

/** Lower-cased content words (length ≥ 4, not a stop-word, deduped). */
export function keywords(text: string): string[] {
  const words = (text || '').toLowerCase().match(/[a-z][a-z'-]*/g) ?? []
  const out = new Set<string>()
  for (const w of words) {
    const clean = w.replace(/[^a-z]/g, '')
    if (clean.length >= 4 && !STOPWORDS.has(clean)) out.add(clean)
  }
  return [...out]
}

export interface ThesisCheck {
  /** True only when we had enough to judge (a thesis with keywords + a written paragraph). */
  checked: boolean
  /** True when the paragraph shares at least one keyword with the thesis. */
  onThesis: boolean
  /** The shared keywords, if any. */
  shared: string[]
}

const MIN_PARAGRAPH_WORDS = 6

/** Does this paragraph's text appear to connect to the thesis? */
export function checkOnThesis(thesisText: string, paragraphText: string): ThesisCheck {
  const thesisKeys = new Set(keywords(thesisText))
  const paraWords = (paragraphText || '').trim().split(/\s+/).filter(Boolean)
  if (thesisKeys.size === 0 || paraWords.length < MIN_PARAGRAPH_WORDS) {
    return { checked: false, onThesis: true, shared: [] }
  }
  const shared = keywords(paragraphText).filter((k) => thesisKeys.has(k))
  return { checked: true, onThesis: shared.length > 0, shared }
}
