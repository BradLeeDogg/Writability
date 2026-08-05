// Paper-format helpers (MLA / APA / Chicago) and page-size math. Pure and
// shared so the editor footer, the new-paper dialog, and the export pipeline
// all agree on what a "page" is and how each style is laid out.

export type PaperFormat = 'mla' | 'apa' | 'chicago' | 'none'

export const PAPER_FORMATS: { value: PaperFormat; label: string; blurb: string }[] = [
  { value: 'mla', label: 'MLA', blurb: 'English & humanities. Name block, last-name + page header, Works Cited.' },
  { value: 'apa', label: 'APA', blurb: 'Science & social science. Title page, page numbers, References.' },
  { value: 'chicago', label: 'Chicago', blurb: 'History & humanities. Title page, page numbers, Bibliography.' },
  { value: 'none', label: 'No set format', blurb: 'Just a clean, readable document.' }
]

/** The student-supplied heading fields shown on the paper. */
export interface PaperHeading {
  studentName?: string
  instructor?: string
  course?: string
  date?: string
}

/**
 * Words on a typical double-spaced, 12pt, 1-inch-margin page. A deliberate
 * round estimate — enough for "about N pages", not a promise.
 */
export const WORDS_PER_PAGE = 250

export function estimatePages(words: number): number {
  return words <= 0 ? 0 : Math.max(1, Math.ceil(words / WORDS_PER_PAGE))
}

export interface PageStats {
  /** Estimated page count (0 when empty). */
  pages: number
  /** Approximate words still needed to fill the current page. */
  wordsToNextPage: number
}

export function pageStats(words: number): PageStats {
  const pages = estimatePages(words)
  const onPage = words % WORDS_PER_PAGE
  const wordsToNextPage = words <= 0 ? WORDS_PER_PAGE : onPage === 0 ? 0 : WORDS_PER_PAGE - onPage
  return { pages, wordsToNextPage }
}

/** The citation style that matches a paper format. */
export function citationStyleFor(format: PaperFormat): 'mla' | 'apa' | 'chicago' {
  return format === 'apa' ? 'apa' : format === 'chicago' ? 'chicago' : 'mla'
}

/** Layout decisions for a format, shared by the docx and PDF exporters. */
export interface FormatSpec {
  /** A separate, centred title page (APA, Chicago). */
  titlePage: boolean
  /** MLA-style top-left name / instructor / course / date block. */
  mlaHeaderBlock: boolean
  /** Running-header page number style. */
  pageNumber: 'none' | 'right' | 'mla'
  /** Repeat the title (bold, centred) at the top of the body (APA). */
  titleOnBody: boolean
  /** Heading above the source list. */
  referenceLabel: string
}

export function formatSpec(format: PaperFormat): FormatSpec {
  switch (format) {
    case 'mla':
      return { titlePage: false, mlaHeaderBlock: true, pageNumber: 'mla', titleOnBody: false, referenceLabel: 'Works Cited' }
    case 'apa':
      return { titlePage: true, mlaHeaderBlock: false, pageNumber: 'right', titleOnBody: true, referenceLabel: 'References' }
    case 'chicago':
      return { titlePage: true, mlaHeaderBlock: false, pageNumber: 'right', titleOnBody: false, referenceLabel: 'Bibliography' }
    default:
      return { titlePage: false, mlaHeaderBlock: false, pageNumber: 'none', titleOnBody: false, referenceLabel: 'Works Cited' }
  }
}

/** Surname for an MLA running header ("Smith 3"). Falls back to the whole name. */
export function lastNameOf(name?: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

/** The non-empty MLA heading lines, in order. */
export function mlaHeadingLines(heading?: PaperHeading): string[] {
  const h = heading ?? {}
  return [h.studentName, h.instructor, h.course, h.date].map((s) => (s ?? '').trim()).filter(Boolean)
}

/** The centred lines under the title on an APA/Chicago title page. */
export function titlePageLines(heading?: PaperHeading): string[] {
  const h = heading ?? {}
  return [h.studentName, h.course, h.instructor, h.date].map((s) => (s ?? '').trim()).filter(Boolean)
}
