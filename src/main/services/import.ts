// DOCX import via mammoth. Converts a Word document to HTML the editor can
// ingest, and reports honestly what was kept and what was dropped — never a
// silent lossy import.
import { dialog } from 'electron'
import { readFile } from 'fs/promises'
import { basename } from 'path'
import mammoth from 'mammoth'

export interface ImportResult {
  ok: boolean
  canceled?: boolean
  error?: string
  title?: string
  html?: string
  kept?: string[]
  dropped?: string[]
}

export async function importDocx(): Promise<ImportResult> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import a Word document',
    properties: ['openFile'],
    filters: [{ name: 'Word document', extensions: ['docx'] }]
  })
  if (canceled || !filePaths[0]) return { ok: false, canceled: true }

  try {
    const buffer = await readFile(filePaths[0])
    const converted = await convertDocxBuffer(buffer)
    return {
      ok: true,
      title: basename(filePaths[0]).replace(/\.docx$/i, ''),
      ...converted
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

/** Pure-ish core of the import (no dialogs) so the self-test can cover it. */
export async function convertDocxBuffer(
  buffer: Buffer
): Promise<{ html: string; kept: string[]; dropped: string[] }> {
  const result = await mammoth.convertToHtml({ buffer })
  const html = result.value
  const kept: string[] = []
  const dropped: string[] = []

  if (/<h[1-6]/.test(html)) kept.push('Headings')
  if (/<(strong|b)>/.test(html)) kept.push('Bold')
  if (/<(em|i)>/.test(html)) kept.push('Italics')
  if (/<(ul|ol)>/.test(html)) kept.push('Lists')
  kept.push('Paragraph text')

  // The editor's schema has no images or tables; footnotes arrive as plain
  // linked text at the end. Say so plainly.
  if (/<img/.test(html)) dropped.push('Images (the editor is text-only)')
  if (/<table/.test(html)) dropped.push('Tables (rows become plain lines)')
  if (/footnote/i.test(html)) dropped.push('Footnote formatting (notes arrive as plain text at the end)')
  for (const m of result.messages) {
    const note = m.message.replace(/\s+/g, ' ').trim()
    if (note && !dropped.includes(note)) dropped.push(note)
  }
  return { html, kept, dropped }
}
