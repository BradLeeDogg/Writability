// Helpers for working with TipTap / ProseMirror JSON documents.
// Pure and dependency-free so the main process (export, self-test) and the
// renderer can share them.

import { applyCase, normalizeWord } from './spelling'

interface DocNode {
  type?: string
  text?: string
  content?: DocNode[]
}

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'listItem',
  'bulletList',
  'orderedList',
  'codeBlock'
])

/** Flatten a TipTap doc to plain text, with blank lines between blocks. */
export function docToPlainText(doc: unknown): string {
  const root = doc as DocNode | null | undefined
  if (!root || typeof root !== 'object') return ''

  const lines: string[] = []
  const walkBlock = (node: DocNode): void => {
    if (!node) return
    if (node.type && BLOCK_TYPES.has(node.type) && node.type !== 'bulletList' && node.type !== 'orderedList') {
      lines.push(collectInline(node))
      return
    }
    if (node.content) node.content.forEach(walkBlock)
  }

  const collectInline = (node: DocNode): string => {
    if (node.text) return node.text
    if (!node.content) return ''
    return node.content.map(collectInline).join('')
  }

  walkBlock(root)
  return lines.filter((l) => l.length > 0).join('\n\n').trim()
}

/** Plain paragraphs (one string per block) — handy for export. */
export function docToParagraphs(doc: unknown): string[] {
  return docToPlainText(doc)
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)
}

export function countWords(text: string): number {
  const m = text.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g)
  return m ? m.length : 0
}

/** A fresh, empty TipTap document. */
export function emptyDoc(): unknown {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}

/**
 * Replace every whole-word occurrence of `target` with `replacement`, matching
 * case-insensitively (curly apostrophes normalised) and preserving each
 * occurrence's capitalisation. Token-based, so it never touches substrings.
 * Returns a new document; the input is left untouched.
 */
export function replaceWordInDoc(doc: unknown, target: string, replacement: string): unknown {
  const targetLower = normalizeWord(target).toLowerCase()
  if (!targetLower) return doc
  const wordRe = /[A-Za-z'’]+/g
  const fix = (node: DocNode): DocNode => {
    if (typeof node.text === 'string') {
      const next = node.text.replace(wordRe, (tok) =>
        normalizeWord(tok).toLowerCase() === targetLower ? applyCase(tok, replacement) : tok
      )
      return next === node.text ? node : { ...node, text: next }
    }
    if (node.content) return { ...node, content: node.content.map(fix) }
    return node
  }
  return fix(doc as DocNode)
}

export interface Sentence {
  text: string
  /** Offsets into the source string (so a TTS char index maps to a sentence). */
  start: number
  end: number
}

/**
 * Split text into sentences, keeping each one's offset range in the source
 * string. Paragraph breaks always end a sentence; otherwise we break after
 * .!? (and any trailing quotes/brackets) when followed by whitespace or the
 * end. Offsets let read-aloud highlight the sentence under a speech boundary.
 */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = []
  if (!text) return out
  const n = text.length
  const closers = '.!?")]’”'
  let i = 0
  let start = 0
  const push = (s: number, e: number): void => {
    const raw = text.slice(s, e)
    if (raw.trim().length > 0) out.push({ text: raw.trim(), start: s, end: e })
  }
  while (i < n) {
    const ch = text[i]
    if (ch === '\n') {
      push(start, i)
      i++
      start = i
      continue
    }
    if (ch === '.' || ch === '!' || ch === '?') {
      let j = i + 1
      while (j < n && closers.includes(text[j])) j++
      if (j >= n || /\s/.test(text[j])) {
        push(start, j)
        while (j < n && /\s/.test(text[j])) j++
        i = j
        start = i
        continue
      }
      i = j
      continue
    }
    i++
  }
  if (start < n) push(start, n)
  return out
}

/** A maximal run of non-whitespace, with its offsets in the source string. */
export interface Word {
  text: string
  start: number
  end: number
}

/** Split text into words (non-whitespace runs), keeping each word's offsets. */
export function splitWords(text: string): Word[] {
  const out: Word[] = []
  if (!text) return out
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length })
  }
  return out
}

/** Index of the span (sentence or word) that starts at/before a source offset. */
function spanIndexAt(spans: { start: number }[], charIndex: number): number {
  let idx = 0
  for (let k = 0; k < spans.length; k++) {
    if (spans[k].start <= charIndex) idx = k
    else break
  }
  return idx
}

/** Which sentence contains a given source offset (the last one starting at/before it). */
export function sentenceIndexAt(sentences: Sentence[], charIndex: number): number {
  return spanIndexAt(sentences, charIndex)
}

/** Which word contains a given source offset (the last one starting at/before it). */
export function wordIndexAt(words: Word[], charIndex: number): number {
  return spanIndexAt(words, charIndex)
}
