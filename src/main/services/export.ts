import { app, BrowserWindow, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import {
  AlignmentType,
  Document,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  TextRun
} from 'docx'
import { openPaper } from './papers'
import { docToParagraphs, docToPlainText } from '@shared/doc'
import { formatCitation, referenceSegments } from '@shared/citations'
import {
  citationStyleFor,
  formatSpec,
  lastNameOf,
  mlaHeadingLines,
  titlePageLines
} from '@shared/format'
import type { FormatSpec, PaperFormat } from '@shared/format'
import type { ExportInput, ExportResult } from '@shared/api'
import type { ExportFormat, Paper } from '@shared/types'

const FILTERS: Record<ExportFormat, Electron.FileFilter[]> = {
  docx: [{ name: 'Word document', extensions: ['docx'] }],
  pdf: [{ name: 'PDF', extensions: ['pdf'] }],
  txt: [{ name: 'Plain text', extensions: ['txt'] }]
}

const DOUBLE = 480 // line spacing in twentieths of a point (double-spaced)
const INDENT = 720 // first-line indent in twips (0.5 inch)

function paperFormat(paper: Paper): PaperFormat {
  return paper.meta.format ?? 'none'
}
function wantsPageNumbers(paper: Paper, spec: FormatSpec): boolean {
  return paper.meta.pageNumbers !== false && spec.pageNumber !== 'none'
}

/** Build the export bytes for a paper. Used by exportPaper and the self-test. */
export async function renderExport(paper: Paper, format: ExportFormat): Promise<Buffer> {
  if (format === 'docx') return buildDocx(paper)
  if (format === 'pdf') return buildPdf(paper)
  return Buffer.from(buildTxt(paper), 'utf8')
}

export async function exportPaper(input: ExportInput): Promise<ExportResult> {
  const paper = openPaper(input.id)
  if (!paper) return { ok: false, error: 'Paper not found' }

  const safeTitle = paper.meta.title.replace(/[^\w\- ]+/g, '').trim() || 'paper'
  const defaultPath = join(app.getPath('documents'), `${safeTitle}.${input.format}`)

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export paper',
    defaultPath,
    filters: FILTERS[input.format]
  })
  if (canceled || !filePath) return { ok: false, canceled: true }

  try {
    const bytes = await renderExport(paper, input.format)
    await writeFile(filePath, bytes)
    return { ok: true, path: filePath }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// --- Word (.docx) -----------------------------------------------------------
function bodyPara(text: string, opts: { indent?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; bold?: boolean } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    spacing: { line: DOUBLE, after: 0 },
    indent: opts.indent ? { firstLine: INDENT } : undefined,
    children: [new TextRun({ text, bold: opts.bold })]
  })
}

function titlePageDocx(paper: Paper, fmt: PaperFormat): Paragraph[] {
  const out: Paragraph[] = []
  for (let i = 0; i < 8; i++) out.push(new Paragraph({ children: [new TextRun('')] }))
  out.push(bodyPara(paper.meta.title, { align: AlignmentType.CENTER, bold: fmt === 'apa' }))
  for (let i = 0; i < 6; i++) out.push(new Paragraph({ children: [new TextRun('')] }))
  for (const line of titlePageLines(paper.meta.heading)) {
    out.push(bodyPara(line, { align: AlignmentType.CENTER }))
  }
  return out
}

async function buildDocx(paper: Paper): Promise<Buffer> {
  const fmt = paperFormat(paper)
  const spec = formatSpec(fmt)
  const heading = paper.meta.heading ?? {}
  const children: Paragraph[] = []

  if (spec.titlePage) {
    children.push(...titlePageDocx(paper, fmt))
    children.push(new Paragraph({ pageBreakBefore: true }))
  }

  if (spec.mlaHeaderBlock) {
    for (const line of mlaHeadingLines(heading)) children.push(bodyPara(line, { align: AlignmentType.LEFT }))
  }

  if (fmt === 'mla') {
    children.push(bodyPara(paper.meta.title, { align: AlignmentType.CENTER }))
  } else if (spec.titleOnBody) {
    children.push(bodyPara(paper.meta.title, { align: AlignmentType.CENTER, bold: true }))
  } else if (!spec.titlePage) {
    children.push(new Paragraph({ text: paper.meta.title, heading: HeadingLevel.TITLE }))
  }

  const paras = docToParagraphs(paper.content.doc)
  if (paras.length === 0) children.push(new Paragraph({ children: [new TextRun('')] }))
  else for (const p of paras) children.push(bodyPara(p, { indent: true }))

  if (paper.content.sources.length) {
    const style = citationStyleFor(fmt)
    children.push(bodyPara(spec.referenceLabel, { align: AlignmentType.CENTER, bold: fmt !== 'mla' }))
    for (const s of paper.content.sources) {
      children.push(
        new Paragraph({
          spacing: { line: DOUBLE, after: 0 },
          indent: { hanging: INDENT },
          children: referenceSegments(s, style).map(
            (seg) => new TextRun({ text: seg.text, italics: seg.italic })
          )
        })
      )
    }
  }

  let headers: { default: Header } | undefined
  if (wantsPageNumbers(paper, spec)) {
    const lastName = spec.pageNumber === 'mla' ? lastNameOf(heading.studentName) : ''
    const runs = lastName
      ? [new TextRun(lastName + ' '), new TextRun({ children: [PageNumber.CURRENT] })]
      : [new TextRun({ children: [PageNumber.CURRENT] })]
    headers = { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: runs })] }) }
  }

  const doc = new Document({
    creator: 'Writability',
    title: paper.meta.title,
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    sections: [{ headers, children }]
  })
  return (await Packer.toBuffer(doc)) as Buffer
}

// --- PDF (HTML -> printToPDF) -----------------------------------------------
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderHtml(paper: Paper): string {
  const fmt = paperFormat(paper)
  const spec = formatSpec(fmt)
  const heading = paper.meta.heading ?? {}
  const title = escapeHtml(paper.meta.title)

  let body = ''
  if (spec.titlePage) {
    const lines = titlePageLines(heading).map(escapeHtml).join('<br />')
    body += `<section class="title-page"><h1 class="${fmt === 'apa' ? 'bold' : ''}">${title}</h1><div class="tp-meta">${lines}</div></section>`
  }
  if (spec.mlaHeaderBlock) {
    const lines = mlaHeadingLines(heading).map(escapeHtml).join('<br />')
    if (lines) body += `<div class="mla-head">${lines}</div>`
  }
  if (fmt === 'mla') body += `<h1 class="doc-title">${title}</h1>`
  else if (spec.titleOnBody) body += `<h1 class="doc-title bold">${title}</h1>`
  else if (!spec.titlePage) body += `<h1 class="doc-title">${title}</h1>`

  body += docToParagraphs(paper.content.doc)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('\n')

  if (paper.content.sources.length) {
    const style = citationStyleFor(fmt)
    body +=
      `<h2>${escapeHtml(spec.referenceLabel)}</h2>` +
      paper.content.sources
        .map(
          (s) =>
            `<p class="cite">${referenceSegments(s, style)
              .map((seg) => (seg.italic ? `<i>${escapeHtml(seg.text)}</i>` : escapeHtml(seg.text)))
              .join('')}</p>`
        )
        .join('\n')
  }

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<style>
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 12pt; line-height: 2; color: #111; }
  .title-page { text-align: center; page-break-after: always; padding-top: 3in; }
  .title-page h1 { font-size: 12pt; font-weight: normal; margin: 0; }
  .title-page .tp-meta { margin-top: 2.5in; }
  .bold { font-weight: bold; }
  .mla-head { text-indent: 0; }
  h1.doc-title { font-size: 12pt; font-weight: normal; text-align: center; text-indent: 0; margin: 0; }
  h2 { font-size: 12pt; font-weight: normal; text-align: center; text-indent: 0; }
  p { margin: 0; text-indent: 0.5in; }
  p.cite { text-indent: -0.5in; margin-left: 0.5in; }
</style></head>
<body>${body}</body></html>`
}

async function buildPdf(paper: Paper): Promise<Buffer> {
  const spec = formatSpec(paperFormat(paper))
  const showPageNum = wantsPageNumbers(paper, spec)
  const lastName = spec.pageNumber === 'mla' ? escapeHtml(lastNameOf(paper.meta.heading?.studentName)) : ''
  const headerTemplate = showPageNum
    ? `<div style="width:100%; font-family:'Times New Roman',serif; font-size:11px; padding:0 1in; text-align:right;">${lastName ? lastName + ' ' : ''}<span class="pageNumber"></span></div>`
    : '<span></span>'

  const html = renderHtml(paper)
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true }
  })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'Letter',
      margins: { top: 1, bottom: 1, left: 1, right: 1 },
      displayHeaderFooter: showPageNum,
      headerTemplate,
      footerTemplate: '<span></span>'
    })
    return pdf
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

// --- Plain text -------------------------------------------------------------
function buildTxt(paper: Paper): string {
  const fmt = paperFormat(paper)
  const spec = formatSpec(fmt)
  const heading = paper.meta.heading ?? {}
  const lines: string[] = []
  const head = spec.mlaHeaderBlock ? mlaHeadingLines(heading) : spec.titlePage ? titlePageLines(heading) : []
  if (head.length) lines.push(...head, '')
  lines.push(paper.meta.title, '')
  lines.push(docToPlainText(paper.content.doc))
  if (paper.content.sources.length) {
    const style = citationStyleFor(fmt)
    lines.push('', spec.referenceLabel)
    for (const s of paper.content.sources) lines.push(formatCitation(s, style).reference)
  }
  return lines.join('\n')
}
