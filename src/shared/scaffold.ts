// Turn the scaffolded outline into editable document content, so the plan can
// become the first draft in one step instead of being retyped. Each outline
// step becomes a heading; its prompt becomes a quoted guide line the student
// can write under and then delete; any notes already typed in the outline are
// carried in as a starting paragraph.
//
// Pure TipTap/ProseMirror JSON so it can be unit-tested without a browser.

import type { OutlineNode } from './types'

export interface DocContent {
  type: string
  attrs?: Record<string, unknown>
  content?: DocContent[]
  text?: string
}

function heading(level: number, text: string): DocContent {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }
}

function paragraph(text: string): DocContent {
  return text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' }
}

/** A muted, removable guide line holding the step's prompt. */
function guide(text: string): DocContent {
  return { type: 'blockquote', content: [paragraph(text)] }
}

function nodeToContent(n: OutlineNode, level: number): DocContent[] {
  const out: DocContent[] = [heading(level, n.label)]
  if (n.prompt) out.push(guide(n.prompt))
  out.push(paragraph(n.text)) // the student's notes, or an empty paragraph to write into
  for (const child of n.children) out.push(...nodeToContent(child, Math.min(level + 1, 4)))
  return out
}

/** Flatten an outline into a document skeleton (headings + guides + paragraphs). */
export function outlineToDocContent(outline: OutlineNode[]): DocContent[] {
  const out: DocContent[] = []
  for (const n of outline) out.push(...nodeToContent(n, 2))
  return out
}
