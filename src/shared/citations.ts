// Citation formatting for MLA (9th), APA (7th), and Chicago (author–date).
// Pure functions — imported directly by the renderer and exercised by the
// self-test. Output is plain text; students can italicise titles in their word
// processor (we note this in the UI).

import type { CitationSource, CitationStyle, FormattedCitation } from './types'

interface Name {
  last: string
  first: string
}

function parseName(raw: string): Name {
  const s = raw.trim()
  if (s.includes(',')) {
    const [last, ...rest] = s.split(',')
    return { last: last.trim(), first: rest.join(',').trim() }
  }
  // "First Last" fallback.
  const parts = s.split(/\s+/)
  if (parts.length === 1) return { last: parts[0], first: '' }
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(' ') }
}

function initials(first: string): string {
  return first
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + '.')
    .join(' ')
}

function tidy(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([,;:])\s*([.;:])/g, '$2')
    .replace(/\.{2,}/g, '.')
    .replace(/\(\s*\)/g, '')
    .replace(/,\s*\./g, '.')
    .trim()
}

function join(parts: Array<string | undefined | false>): string {
  return tidy(parts.filter(Boolean).join(' '))
}

// --- Author lists per style -------------------------------------------------

function mlaAuthors(authors: string[]): string {
  const n = authors.map(parseName)
  if (!n.length) return ''
  const full = (x: Name): string => (x.first ? `${x.last}, ${x.first}` : x.last)
  if (n.length === 1) return full(n[0])
  if (n.length === 2) return `${full(n[0])}, and ${n[1].first ? `${n[1].first} ${n[1].last}` : n[1].last}`
  return `${full(n[0])}, et al`
}

function apaAuthors(authors: string[]): string {
  const n = authors.map(parseName)
  if (!n.length) return ''
  const fmt = (x: Name): string => (x.first ? `${x.last}, ${initials(x.first)}` : x.last)
  if (n.length === 1) return fmt(n[0])
  const all = n.map(fmt)
  const last = all.pop()
  return `${all.join(', ')}, & ${last}`
}

function chicagoAuthors(authors: string[]): string {
  const n = authors.map(parseName)
  if (!n.length) return ''
  const first = (x: Name): string => (x.first ? `${x.last}, ${x.first}` : x.last)
  const rest = (x: Name): string => (x.first ? `${x.first} ${x.last}` : x.last)
  if (n.length === 1) return first(n[0])
  if (n.length === 2) return `${first(n[0])}, and ${rest(n[1])}`
  if (n.length === 3) return `${first(n[0])}, ${rest(n[1])}, and ${rest(n[2])}`
  return `${first(n[0])} et al`
}

// --- In-text author phrase --------------------------------------------------

function inTextAuthor(source: CitationSource, style: CitationStyle): string {
  const names = source.authors.map(parseName)
  if (!names.length) {
    const t = source.title.split(/\s+/).slice(0, 3).join(' ')
    return `"${t}"`
  }
  const surnames = names.map((x) => x.last)
  if (surnames.length === 1) return surnames[0]
  if (surnames.length === 2) {
    const conj = style === 'apa' ? '&' : 'and'
    return `${surnames[0]} ${conj} ${surnames[1]}`
  }
  return `${surnames[0]} et al.`
}

// --- Reference entries ------------------------------------------------------

function mlaReference(s: CitationSource): string {
  const authors = mlaAuthors(s.authors)
  const authorPart = authors ? `${authors}.` : ''
  if (s.type === 'book') {
    return join([authorPart, `${s.title}.`, s.publisher && `${s.publisher},`, s.year && `${s.year}.`])
  }
  if (s.type === 'journal') {
    return join([
      authorPart,
      `"${s.title}."`,
      s.containerTitle && `${s.containerTitle},`,
      s.volume && `vol. ${s.volume},`,
      s.issue && `no. ${s.issue},`,
      s.year && `${s.year},`,
      s.pages && `pp. ${s.pages}.`
    ])
  }
  return join([
    authorPart,
    `"${s.title}."`,
    s.containerTitle && `${s.containerTitle},`,
    s.year && `${s.year},`,
    s.url && `${s.url}.`,
    s.accessed && `Accessed ${s.accessed}.`
  ])
}

function apaReference(s: CitationSource): string {
  const authors = apaAuthors(s.authors)
  const authorPart = authors ? `${authors}` : s.title
  const year = `(${s.year || 'n.d.'}).`
  if (s.type === 'book') {
    return join([`${authorPart}`, year, `${s.title}.`, s.publisher && `${s.publisher}.`])
  }
  if (s.type === 'journal') {
    const vol = join([
      s.containerTitle && `${s.containerTitle},`,
      s.volume && `${s.volume}`,
      s.issue && `(${s.issue})`,
      s.pages && `, ${s.pages}.`
    ])
    return join([`${authorPart}`, year, `${s.title}.`, vol])
  }
  return join([`${authorPart}`, year, `${s.title}.`, s.containerTitle && `${s.containerTitle}.`, s.url])
}

function chicagoReference(s: CitationSource): string {
  const authors = chicagoAuthors(s.authors)
  const authorPart = authors ? `${authors}.` : ''
  const year = s.year ? `${s.year}.` : 'n.d.'
  if (s.type === 'book') {
    return join([authorPart, year, `${s.title}.`, s.publisher && `${s.publisher}.`])
  }
  if (s.type === 'journal') {
    return join([
      authorPart,
      year,
      `"${s.title}."`,
      s.containerTitle && `${s.containerTitle}`,
      s.volume && `${s.volume}`,
      s.issue && `(${s.issue})`,
      s.pages ? `: ${s.pages}.` : '.'
    ])
  }
  return join([authorPart, year, `"${s.title}."`, s.containerTitle && `${s.containerTitle}.`, s.url && `${s.url}.`])
}

// --- In-text markers --------------------------------------------------------

function inText(s: CitationSource, style: CitationStyle): string {
  const who = inTextAuthor(s, style)
  if (style === 'mla') {
    return `(${join([who, s.pages]).trim()})`
  }
  if (style === 'apa') {
    const page = s.pages ? `, p. ${s.pages}` : ''
    return `(${who}, ${s.year || 'n.d.'}${page})`
  }
  const page = s.pages ? `, ${s.pages}` : ''
  return `(${who} ${s.year || 'n.d.'}${page})`
}

export function formatCitation(source: CitationSource, style: CitationStyle): FormattedCitation {
  let reference: string
  switch (style) {
    case 'apa':
      reference = apaReference(source)
      break
    case 'chicago':
      reference = chicagoReference(source)
      break
    case 'mla':
    default:
      reference = mlaReference(source)
      break
  }
  return { inText: inText(source, style), reference }
}

/** A reference split into styled runs so titles can be italicised properly
 *  (MLA/APA/Chicago all require it). Falls back to one roman segment. */
export interface ReferenceSegment {
  text: string
  italic: boolean
}

export function referenceSegments(source: CitationSource, style: CitationStyle): ReferenceSegment[] {
  const reference = formatCitation(source, style).reference
  // What gets italicised: a book's title; otherwise the container (journal/site).
  const italicised: string[] = []
  if (source.type === 'book' && source.title) italicised.push(source.title)
  else if (source.containerTitle) italicised.push(source.containerTitle)
  if (style === 'apa' && source.type === 'journal' && source.volume) italicised.push(source.volume)

  let segments: ReferenceSegment[] = [{ text: reference, italic: false }]
  for (const target of italicised) {
    const next: ReferenceSegment[] = []
    for (const seg of segments) {
      if (seg.italic) {
        next.push(seg)
        continue
      }
      const i = seg.text.indexOf(target)
      if (i === -1) {
        next.push(seg)
        continue
      }
      if (i > 0) next.push({ text: seg.text.slice(0, i), italic: false })
      next.push({ text: target, italic: true })
      if (i + target.length < seg.text.length)
        next.push({ text: seg.text.slice(i + target.length), italic: false })
    }
    segments = next
  }
  return segments
}

export const CITATION_STYLE_LABELS: Record<CitationStyle, string> = {
  mla: 'MLA (9th)',
  apa: 'APA (7th)',
  chicago: 'Chicago (author–date)'
}
