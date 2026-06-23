// Reading support for dense source text. Many students can decode the words of
// an academic source but lose the thread of what it is actually claiming. This
// offline helper pulls out the likely main idea and the few most important
// sentences (a simple extractive summary), plus a plain reading-level label, so
// a wall of text becomes something to orient around. No AI, no network.

import { analyzeClarity } from './clarity'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'so', 'because', 'as',
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'into', 'over',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these',
  'those', 'it', 'its', 'they', 'them', 'their', 'there', 'here', 'from',
  'than', 'such', 'also', 'which', 'who', 'what', 'when', 'where', 'how',
  'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should'
])

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=["'“‘(]?[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export interface SourceSummary {
  /** The single sentence that looks most central. */
  mainClaim: string
  /** The most important sentences, in their original order. */
  keySentences: string[]
  sentenceCount: number
  wordCount: number
  /** Plain-language reading-level label (from the clarity analyser). */
  readingLabel: string
}

/** Extractive summary: rank sentences by how many common content words they carry. */
export function summarizeSource(text: string): SourceSummary {
  const clean = (text || '').trim()
  const report = analyzeClarity(clean)
  const sentences = splitSentences(clean)
  if (sentences.length === 0) {
    return { mainClaim: '', keySentences: [], sentenceCount: 0, wordCount: 0, readingLabel: report.readingLabel }
  }

  const freq = new Map<string, number>()
  for (const w of clean.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []) {
    if (w.length < 4 || STOPWORDS.has(w)) continue
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }

  const score = (s: string): number => {
    const words = s.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []
    if (words.length === 0) return 0
    let total = 0
    for (const w of words) total += freq.get(w) ?? 0
    // Normalise by sqrt(length) so we don't simply pick the longest sentence.
    return total / Math.sqrt(words.length)
  }

  const ranked = sentences
    .map((s, i) => ({ s, i, score: score(s) }))
    .sort((a, b) => b.score - a.score)

  const keySentences = ranked
    .slice(0, Math.min(3, sentences.length))
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s)

  return {
    mainClaim: ranked[0].s,
    keySentences,
    sentenceCount: report.sentenceCount,
    wordCount: report.wordCount,
    readingLabel: report.readingLabel
  }
}
