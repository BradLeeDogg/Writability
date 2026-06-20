import { app, BrowserWindow, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
} from 'docx'
import { openPaper } from './papers'
import { docToParagraphs, docToPlainText } from '@shared/doc'
import { formatCitation } from '@shared/citations'
import type { ExportInput, ExportResult } from '@shared/api'
import type { ExportFormat, Paper } from '@shared/types'

const FILTERS: Record<ExportFormat, Electron.FileFilter[]> = {
  docx: [{ name: 'Word document', extensions: ['docx'] }],
  pdf: [{ name: 'PDF', extensions: ['pdf'] }],
  txt: [{ name: 'Plain text', extensions: ['txt'] }]
}

/** Build the export bytes for a paper. Used by exportPaper and the self-test. */
export async function renderExport(paper: Paper, format: ExportFormat): Promise<Buffer> {
  if (format === 'docx') return buildDocx(paper)
  if (format === 'pdf') return buildPdf(paper)
  return Buffer.from(docToPlainText(paper.content.doc), 'utf8')
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

async function buildDocx(paper: Paper): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: paper.meta.title, heading: HeadingLevel.TITLE })
  ]

  const paras = docToParagraphs(paper.content.doc)
  if (paras.length === 0) {
    children.push(new Paragraph({ children: [new TextRun('')] }))
  } else {
    for (const p of paras) {
      children.push(
        new Paragraph({
          spacing: { line: 360, after: 120 },
          children: [new TextRun(p)]
        })
      )
    }
  }

  if (paper.content.sources.length) {
    children.push(
      new Paragraph({
        text: 'Works Cited',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER
      })
    )
    for (const s of paper.content.sources) {
      children.push(new Paragraph({ children: [new TextRun(formatCitation(s, 'mla').reference)] }))
    }
  }

  const doc = new Document({
    creator: 'Writability',
    title: paper.meta.title,
    sections: [{ children }]
  })
  // docx returns a Buffer here in the Node build.
  return (await Packer.toBuffer(doc)) as Buffer
}

async function buildPdf(paper: Paper): Promise<Buffer> {
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
      margins: { top: 1, bottom: 1, left: 1, right: 1 }
    })
    return pdf
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderHtml(paper: Paper): string {
  const paras = docToParagraphs(paper.content.doc)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('\n')
  const works = paper.content.sources.length
    ? `<h2>Works Cited</h2>` +
      paper.content.sources
        .map((s) => `<p class="cite">${escapeHtml(formatCitation(s, 'mla').reference)}</p>`)
        .join('\n')
    : ''
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<style>
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 2;
         color: #111; max-width: 7in; margin: 0 auto; }
  h1 { font-size: 18pt; text-align: center; }
  h2 { font-size: 14pt; text-align: center; }
  p { margin: 0 0 0.5em; text-indent: 0.5in; }
  p.cite { text-indent: -0.5in; padding-left: 0.5in; }
</style></head>
<body>
  <h1>${escapeHtml(paper.meta.title)}</h1>
  ${paras}
  ${works}
</body></html>`
}
