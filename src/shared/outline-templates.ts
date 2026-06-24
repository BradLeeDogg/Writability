// Outline scaffolds per essay type.
//
// The whole point of Writability's outline is to beat blank-page paralysis:
// every step comes pre-labelled with a gentle, literal prompt that says what to
// write and *why* it matters. Students fill in the `text`; nothing here is
// jargon or idiom.

import { uid } from './ids'
import type { EssayType, OutlineNode } from './types'

function node(
  kind: OutlineNode['kind'],
  label: string,
  prompt: string,
  children: OutlineNode[] = []
): OutlineNode {
  return { id: uid('node'), kind, label, prompt, text: '', done: false, children }
}

/** A reusable body paragraph: point → evidence → analysis → link (PEEL). */
export function makeBodyParagraph(n: number): OutlineNode {
  return node('point', `Point ${n}`, `State one reason that supports your thesis. One clear sentence is enough.`, [
    node(
      'evidence',
      'Evidence',
      `Give a fact, quote, or example that backs up Point ${n}. Where did it come from?`
    ),
    node(
      'analysis',
      'Analysis',
      `Explain how this evidence proves your point. Why does it matter? Say it plainly.`
    ),
    node(
      'link',
      'Link back',
      `Connect this paragraph back to your thesis in one sentence, so the reader sees the thread.`
    )
  ])
}

function argumentOutline(): OutlineNode[] {
  return [
    node(
      'thesis',
      'Thesis',
      `Write the one main idea your whole paper will argue. Try: "I will show that ___ because ___."`
    ),
    makeBodyParagraph(1),
    makeBodyParagraph(2),
    makeBodyParagraph(3),
    node(
      'section',
      'Counterargument',
      `Name one thing someone who disagrees might say — then answer it. This makes your argument stronger.`
    ),
    node(
      'section',
      'Conclusion',
      `Restate your thesis in fresh words and say why it matters. No new evidence here.`
    )
  ]
}

function researchOutline(): OutlineNode[] {
  return [
    node(
      'thesis',
      'Research question & thesis',
      `Write the question you are answering, then your answer in one sentence (your thesis).`
    ),
    node(
      'section',
      'Background',
      `Give the reader the facts they need before your argument. What should they already know?`
    ),
    makeBodyParagraph(1),
    makeBodyParagraph(2),
    makeBodyParagraph(3),
    node(
      'section',
      'Conclusion',
      `Sum up what your sources show and answer your research question clearly.`
    )
  ]
}

function labOutline(): OutlineNode[] {
  return [
    node('thesis', 'Hypothesis', `Write what you predicted would happen, and why you thought so.`),
    node('section', 'Materials', `List what you used. A plain list is fine.`),
    node('section', 'Method', `Describe the steps you took, in order, so someone could repeat them.`),
    node('evidence', 'Results', `Report what actually happened. Numbers, observations, tables — just the data.`),
    node(
      'analysis',
      'Discussion',
      `Explain what the results mean. Did they match your hypothesis? What could explain any difference?`
    ),
    node('section', 'Conclusion', `State, in one or two sentences, what you learned.`)
  ]
}

function thesisOutline(): OutlineNode[] {
  return [
    node(
      'thesis',
      'Thesis statement',
      `Write the central claim your long essay defends. Keep it to one clear sentence.`
    ),
    node('section', 'Introduction', `Set up the topic and end with your thesis. Why should the reader care?`),
    makeBodyParagraph(1),
    makeBodyParagraph(2),
    makeBodyParagraph(3),
    makeBodyParagraph(4),
    node('section', 'Conclusion', `Tie the sections together and restate your thesis with its significance.`)
  ]
}

function reflectionOutline(): OutlineNode[] {
  return [
    node('thesis', 'Focus', `In one sentence, what experience or idea is this reflection about?`),
    node('evidence', 'What happened', `Describe the experience plainly. Who, what, where, when?`),
    node('analysis', 'Your reaction', `How did it make you feel or think? It is okay to be honest.`),
    node('analysis', 'What it means', `What did you learn or notice about yourself or the topic?`),
    node('link', 'Going forward', `How will this change what you do or think next time?`)
  ]
}

const BUILDERS: Record<EssayType, () => OutlineNode[]> = {
  argument: argumentOutline,
  research: researchOutline,
  lab: labOutline,
  thesis: thesisOutline,
  reflection: reflectionOutline
}

export function makeOutline(essayType: EssayType): OutlineNode[] {
  return (BUILDERS[essayType] ?? argumentOutline)()
}

/** A free-form note carrying a student's idea (e.g. a board card promoted to the outline). */
export function makeNote(text: string): OutlineNode {
  return { id: uid('node'), kind: 'note', label: 'Note', prompt: '', text, done: false, children: [] }
}

/**
 * Append a note to a section. If `parentId` matches a top-level node the note
 * becomes its child (so the idea lands under the part of the paper it belongs
 * to); otherwise it is added at the end as a top-level note.
 */
export function insertNoteUnder(
  nodes: OutlineNode[],
  parentId: string | undefined,
  text: string
): OutlineNode[] {
  const note = makeNote(text)
  if (parentId) {
    let found = false
    const next = nodes.map((n) => {
      if (n.id !== parentId) return n
      found = true
      return { ...n, children: [...n.children, note] }
    })
    if (found) return next
  }
  return [...nodes, note]
}

/** The thesis-like step (always the first node in every template). */
export function findThesisNode(nodes: OutlineNode[]): OutlineNode | undefined {
  return nodes.find((n) => n.kind === 'thesis')
}

/** Next "Point N" number, based on how many body paragraphs already exist. */
export function nextBodyParagraphNumber(nodes: OutlineNode[]): number {
  return nodes.filter((n) => n.kind === 'point').length + 1
}

/** Count of leaf-ish checkable steps + how many are done, for progress. */
export function outlineProgress(nodes: OutlineNode[]): { total: number; done: number } {
  let total = 0
  let done = 0
  const walk = (list: OutlineNode[]): void => {
    for (const n of list) {
      total += 1
      if (n.done) done += 1
      if (n.children.length) walk(n.children)
    }
  }
  walk(nodes)
  return { total, done }
}
