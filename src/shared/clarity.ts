// Clarity checks — local, offline heuristics. No AI, no network.
//
// The goal is gentle, literal, specific feedback that says *why* something
// might be hard to read. We deliberately cap the number of flags so the panel
// stays calm rather than overwhelming.

import type { ClarityIssue, ClarityReport } from './types'

const MAX_ISSUES = 24
const LONG_SENTENCE_WORDS = 26

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'so', 'because', 'as',
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'into', 'over',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'this', 'that',
  'these', 'those', 'it', 'its', 'they', 'them', 'their', 'there', 'here',
  'i', 'you', 'he', 'she', 'we', 'his', 'her', 'our', 'your', 'my', 'me',
  'not', 'no', 'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would',
  'can', 'could', 'should', 'may', 'might', 'must', 'from', 'than', 'too',
  'very', 'just', 'also', 'which', 'who', 'what', 'when', 'where', 'how'
])

const IRREGULAR_PARTICIPLES = [
  'done', 'gone', 'made', 'given', 'taken', 'seen', 'known', 'written',
  'shown', 'held', 'told', 'found', 'built', 'sent', 'kept', 'brought',
  'bought', 'caught', 'taught', 'thought', 'left', 'felt', 'met', 'paid',
  'put', 'said', 'set', 'spent', 'understood', 'won', 'chosen', 'driven',
  'broken', 'spoken', 'stolen', 'frozen', 'hidden', 'beaten', 'born'
]

// Common long-but-everyday words we shouldn't nag about.
const COMMON_LONG = new Set([
  'everything', 'something', 'anything', 'because', 'different', 'difficult',
  'important', 'understand', 'understanding', 'information', 'experience',
  'community', 'government', 'education', 'family', 'remember', 'beautiful',
  'together', 'another', 'everyone', 'everybody', 'somebody', 'history',
  'national', 'general', 'usually', 'probably', 'actually', 'finally',
  'example', 'examples', 'paragraph', 'sentence', 'evidence', 'analysis'
])

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=["'“‘(]?[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function wordsIn(text: string): string[] {
  return text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []
}

export function countSyllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  if (w.length <= 3) return 1
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  w = w.replace(/^y/, '')
  const groups = w.match(/[aeiouy]{1,2}/g)
  return groups ? groups.length : 1
}

function firstWords(sentence: string, n = 12): string {
  const parts = sentence.split(/\s+/)
  return parts.length <= n ? sentence : parts.slice(0, n).join(' ') + '…'
}

function readingLabelFor(grade: number): string {
  if (grade <= 6) return 'Around grade 6 or below — very easy to read.'
  if (grade <= 9) return `Around grade ${Math.round(grade)} — clear for most readers.`
  if (grade <= 12) return `Around grade ${Math.round(grade)} — high-school level.`
  return `Around grade ${Math.round(grade)} — college level, quite complex.`
}

export function analyzeClarity(text: string): ClarityReport {
  const clean = (text || '').trim()
  const sentences = splitSentences(clean)
  const allWords = wordsIn(clean)
  const wordCount = allWords.length
  const sentenceCount = sentences.length || (wordCount ? 1 : 0)

  let syllableTotal = 0
  for (const w of allWords) syllableTotal += countSyllables(w)

  const avgSentenceLength = sentenceCount ? wordCount / sentenceCount : 0
  const avgSyllables = wordCount ? syllableTotal / wordCount : 0

  const readingEase = wordCount
    ? clampScore(206.835 - 1.015 * avgSentenceLength - 84.6 * avgSyllables)
    : 0
  const gradeLevel = wordCount
    ? Math.max(0, 0.39 * avgSentenceLength + 11.8 * avgSyllables - 15.59)
    : 0

  const issues: ClarityIssue[] = []
  const add = (issue: ClarityIssue): void => {
    if (issues.length < MAX_ISSUES) issues.push(issue)
  }

  // Per-sentence checks ----------------------------------------------------
  let passiveCount = 0
  let ambiguousCount = 0
  for (const sentence of sentences) {
    const sWords = wordsIn(sentence)

    if (sWords.length > LONG_SENTENCE_WORDS) {
      add({
        type: 'long-sentence',
        message: `This sentence is ${sWords.length} words long. Long sentences are harder to follow.`,
        suggestion: 'Try splitting it into two shorter sentences.',
        excerpt: firstWords(sentence)
      })
    }

    if (passiveCount < 6 && looksPassive(sentence)) {
      passiveCount += 1
      add({
        type: 'passive-voice',
        message: 'This may be in the passive voice, so it is not clear who did the action.',
        suggestion: 'Try naming who or what does the action, e.g. "The team measured…".',
        excerpt: firstWords(sentence)
      })
    }

    if (ambiguousCount < 6) {
      const amb = sentence.match(/^(This|That|These|Those|It)\s+(is|are|was|were|will|would|can|could|should|may|might|must|has|have|had|makes|made|shows|showed|means|meant|seems|gives|creates|caused?s?|leads?|happened?)\b/)
      if (amb) {
        ambiguousCount += 1
        add({
          type: 'ambiguous-pronoun',
          message: `Starting with "${amb[1]}" can be unclear — the reader may not know what it points to.`,
          suggestion: `Name the thing, e.g. "${amb[1]} idea…" or "${amb[1]} result…".`,
          excerpt: firstWords(sentence, 8)
        })
      }
    }
  }

  // Whole-text checks ------------------------------------------------------
  // Doubled words ("the the").
  const doubled = clean.match(/\b(\w+)\s+\1\b/gi) ?? []
  const seenDoubles = new Set<string>()
  for (const d of doubled) {
    const key = d.toLowerCase()
    if (seenDoubles.has(key)) continue
    seenDoubles.add(key)
    add({
      type: 'repeated-word',
      message: `The word "${d.split(/\s+/)[0]}" appears twice in a row.`,
      suggestion: 'This is often a typo — check if one copy can be removed.',
      excerpt: d
    })
  }

  // Over-used content words.
  const freq = new Map<string, number>()
  for (const w of allWords) {
    const lw = w.toLowerCase()
    if (lw.length < 5 || STOPWORDS.has(lw)) continue
    freq.set(lw, (freq.get(lw) ?? 0) + 1)
  }
  const overused = [...freq.entries()]
    .filter(([, c]) => c >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  for (const [word, count] of overused) {
    add({
      type: 'repeated-word',
      message: `"${word}" appears ${count} times.`,
      suggestion: 'Repeating a word is fine, but a little variety can help the reader.',
      excerpt: word
    })
  }

  // Long words.
  const longSeen = new Set<string>()
  for (const w of allWords) {
    const lw = w.toLowerCase()
    if (longSeen.has(lw) || COMMON_LONG.has(lw) || STOPWORDS.has(lw)) continue
    if (countSyllables(lw) >= 4 && lw.length >= 9) {
      longSeen.add(lw)
      add({
        type: 'complex-word',
        message: `"${w}" is a long word.`,
        suggestion: 'If a simpler word means the same thing, it may be easier to read.',
        excerpt: w
      })
      if (longSeen.size >= 4) break
    }
  }

  // Spacing.
  if (/[^\n] {2,}\S/.test(clean)) {
    add({
      type: 'spacing',
      message: 'There are extra spaces between some words.',
      suggestion: 'Use a single space between words.',
      excerpt: 'double space'
    })
  }
  if (/\s+[,.;:!?]/.test(clean)) {
    add({
      type: 'spacing',
      message: 'There is a space before a punctuation mark.',
      suggestion: 'Punctuation usually goes right after the word, with no space before it.',
      excerpt: 'space before punctuation'
    })
  }

  return {
    wordCount,
    sentenceCount,
    avgSentenceLength: round1(avgSentenceLength),
    readingEase: Math.round(readingEase),
    gradeLevel: round1(gradeLevel),
    readingLabel: wordCount ? readingLabelFor(gradeLevel) : 'Start writing to see your reading level.',
    issues
  }
}

function looksPassive(sentence: string): boolean {
  const re = new RegExp(
    `\\b(am|is|are|was|were|be|been|being)\\b(\\s+\\w+ly)?\\s+(\\w+(ed|en)\\b|${IRREGULAR_PARTICIPLES.join('|')})`,
    'i'
  )
  return re.test(sentence)
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n))
}
function round1(n: number): number {
  return Math.round(n * 10) / 10
}
