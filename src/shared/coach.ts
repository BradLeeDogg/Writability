// Gather the student's *own* work so the AI coach can be seeded from it — the
// student shouldn't have to retype their thesis or assignment to get help.
// This only collects what they've already written; it never generates text.

import { docToPlainText } from './doc'
import { findThesisNode } from './outline-templates'
import type { PaperContent } from './types'

export interface CoachContext {
  /** The decoded assignment prompt. */
  assignment: string
  /** The thesis sentence from the outline, if written. */
  thesis: string
  /** The student's board cards, one per line. */
  cards: string
  /** The current draft as plain text. */
  draft: string
}

export function coachContext(
  content: Pick<PaperContent, 'assignment' | 'outline' | 'cards' | 'doc'>
): CoachContext {
  const assignment = (content.assignment?.prompt ?? '').trim()
  const thesis = (findThesisNode(content.outline)?.text ?? '').trim()
  const cards = content.cards
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join('\n')
  const draft = docToPlainText(content.doc).trim()
  return { assignment, thesis, cards, draft }
}
