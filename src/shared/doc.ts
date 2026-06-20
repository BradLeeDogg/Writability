// Helpers for working with TipTap / ProseMirror JSON documents.
// Pure and dependency-free so the main process (export, self-test) and the
// renderer can share them.

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
