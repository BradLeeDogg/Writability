// Helpers for working with TipTap / ProseMirror JSON documents.
// Pure and dependency-free so the main process (export, self-test) and the
// renderer can share them.

import { applyCase, normalizeWord } from './spelling'

interface DocNode {
  type?: string
  text?: string
  attrs?: CitationAttrs & { text?: string }
  content?: DocNode[]
}

/** Attributes carried by an inline `citation` node. */
export interface CitationAttrs {
  /** Which source in the paper's list this points at. */
  sourceId?: string
  /** The page this particular quote came from (may be blank). */
  page?: string
  form?: 'parenthetical' | 'narrative'
  /**
   * The marker text as last rendered. Authoritative rendering always comes from
   * the source + the paper's style; this is the fallback for when the source has
   * since been deleted, so a citation never silently becomes empty.
   */
  label?: string
}

/** Resolves a citation node to its marker text, or null if the source is gone. */
export type CitationResolver = (attrs: CitationAttrs) => string | null

function citationText(node: DocNode, resolve?: CitationResolver): string {
  const attrs = (node.attrs ?? {}) as CitationAttrs
  return (resolve ? resolve(attrs) : null) ?? attrs.label ?? ''
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

export interface PlainTextOptions {
  /** Resolve citation markers live from the paper's sources. */
  resolveCitation?: CitationResolver
  /**
   * Speak citations as words rather than punctuation — "(Smith 42)" read aloud
   * is a stumble, "citation: Smith 42" is a checkable fact.
   */
  spokenCitations?: boolean
}

/** Flatten a TipTap doc to plain text, with blank lines between blocks. */
export function docToPlainText(doc: unknown, opts: PlainTextOptions = {}): string {
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
    if (node.type === 'footnote') return '' // notes are exported, not read aloud
    if (node.type === 'citation') {
      const marker = citationText(node, opts.resolveCitation)
      if (!opts.spokenCitations) return marker
      const bare = marker.replace(/[()]/g, '').trim()
      return bare ? `citation: ${bare}` : ''
    }
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

/** Every citation in the document, in order — for "have I actually cited this?". */
export function collectCitations(doc: unknown): CitationAttrs[] {
  const out: CitationAttrs[] = []
  const walk = (node: DocNode): void => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'citation') {
      out.push({ ...((node.attrs ?? {}) as CitationAttrs) })
      return
    }
    for (const child of node.content ?? []) walk(child)
  }
  walk(doc as DocNode)
  return out
}

/** How many times each source is cited, keyed by source id. */
export function citationCounts(doc: unknown): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const c of collectCitations(doc)) {
    if (c.sourceId) counts[c.sourceId] = (counts[c.sourceId] ?? 0) + 1
  }
  return counts
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

// --- Footnotes ---------------------------------------------------------------
export type ParaSegment = { text: string } | { footnote: number }

export interface DocWithNotes {
  /** Block paragraphs as ordered segments (text runs and footnote markers). */
  paragraphs: ParaSegment[][]
  /** Footnote texts, in document order (1-based numbering = index + 1). */
  notes: string[]
}

interface FnNode {
  type?: string
  text?: string
  attrs?: CitationAttrs & { text?: string }
  content?: FnNode[]
}

const FN_BLOCKS = new Set(['paragraph', 'heading', 'blockquote', 'listItem', 'codeBlock'])

/** Flatten a doc into paragraph segments plus an ordered footnote list, so the
 *  exporters can place real footnote references. Pure and schema-tolerant.
 *  Citations flatten to plain text — resolved from the live sources when a
 *  resolver is supplied, so an exported paper never carries a stale marker. */
export function docToParagraphsWithNotes(doc: unknown, resolveCitation?: CitationResolver): DocWithNotes {
  const notes: string[] = []
  const paragraphs: ParaSegment[][] = []
  const root = doc as FnNode | null | undefined
  if (!root || typeof root !== 'object') return { paragraphs, notes }

  const collect = (node: FnNode, out: ParaSegment[]): void => {
    if (node.type === 'footnote') {
      notes.push((node.attrs?.text ?? '').trim())
      out.push({ footnote: notes.length })
      return
    }
    if (node.type === 'citation') {
      const marker = citationText(node, resolveCitation)
      if (marker) out.push({ text: marker })
      return
    }
    if (node.text) {
      out.push({ text: node.text })
      return
    }
    for (const child of node.content ?? []) collect(child, out)
  }

  const walk = (node: FnNode): void => {
    if (node.type && FN_BLOCKS.has(node.type)) {
      const segs: ParaSegment[] = []
      collect(node, segs)
      if (segs.length) paragraphs.push(segs)
      return
    }
    for (const child of node.content ?? []) walk(child)
  }
  walk(root)
  return { paragraphs, notes }
}
