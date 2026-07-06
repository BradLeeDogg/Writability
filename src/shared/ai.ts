// Pure, offline helpers for the opt-in AI features. The prompt builders and
// model list live here (dependency-free, unit-testable); the actual network
// call lives in the main process (src/main/services/ai.ts) and only ever runs
// when the student clicks an AI button with their own key configured.
//
// IMPORTANT product principle: the AI is a *coach*, not a ghostwriter. It helps
// the student brainstorm, plan, and reflect — it must never write the essay,
// paragraphs, or finished sentences for them. Every prompt enforces this.

export type AiTask = 'brainstorm' | 'outline' | 'feedback'

export interface AiPrompt {
  system: string
  user: string
}

export interface AiModelOption {
  id: string
  label: string
  note: string
}

// Defaults to the most capable model; the student can pick a cheaper one.
export const AI_MODELS: AiModelOption[] = [
  { id: 'claude-opus-4-8', label: 'Most capable', note: 'Best quality (Opus)' },
  { id: 'claude-sonnet-4-6', label: 'Balanced', note: 'Good and quicker (Sonnet)' },
  { id: 'claude-haiku-4-5', label: 'Fastest & cheapest', note: 'Great for quick help (Haiku)' }
]

export const DEFAULT_AI_MODEL = 'claude-opus-4-8'

export function isValidModel(id: string): boolean {
  return AI_MODELS.some((m) => m.id === id)
}

// Shared guardrail appended to every coaching prompt.
const NO_GHOSTWRITING =
  ' You are a coach, not a writer. NEVER write the essay, paragraphs, or finished ' +
  'sentences the student could copy in. Your job is to spark and organise THEIR own ' +
  'thinking. Keep ideas short. The student writes the actual words themselves.'

const BRAINSTORM_SYSTEM =
  'You are a warm brainstorming coach for a student, including many who are dyslexic ' +
  'or have ADHD. Given their topic or assignment, offer 5–7 short, distinct ideas, ' +
  'angles, or questions they could explore. Put each on its own line starting with ' +
  '"- ". Keep each to a short phrase or question — not a sentence to copy.' +
  NO_GHOSTWRITING

const OUTLINE_SYSTEM =
  'You are an outlining coach. Given the student\'s topic or thesis, suggest a clear ' +
  'structure for their paper: a short, ordered list of the points or sections to cover. ' +
  'Phrase each as a brief prompt for what THEY should write (e.g. "Introduce the main ' +
  'problem", "Give one example that backs up your point"). One per line starting with ' +
  '"- ". Do not write the content itself.' +
  NO_GHOSTWRITING

const FEEDBACK_SYSTEM =
  'You are a kind, specific writing coach. Read the student\'s draft and give 2–4 short ' +
  'pieces of encouraging feedback or questions that help them improve it themselves ' +
  '(e.g. "Your second point is strong — can you add evidence?"). Point things out and ' +
  'ask questions.' +
  NO_GHOSTWRITING

export function buildPrompt(task: AiTask, text: string): AiPrompt {
  const user = text.trim()
  if (task === 'outline') return { system: OUTLINE_SYSTEM, user }
  if (task === 'feedback') return { system: FEEDBACK_SYSTEM, user }
  return { system: BRAINSTORM_SYSTEM, user }
}

/** Split a coaching reply into discrete items (for cards). Falls back to one item. */
export function splitIntoItems(text: string): string[] {
  const lines = (text || '')
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, '').trim())
    .filter((l) => l.length > 0)
  return lines.length > 0 ? lines : (text || '').trim() ? [(text || '').trim()] : []
}

/** Student-facing summary of the AI contract, kept in lockstep with the
 *  prompts above (the self-test pins them together). */
export const INTEGRITY_STATEMENT =
  'What the AI helper will and will not do:\n' +
  '- It suggests ideas, structures, and questions. Each suggestion is a short phrase, never finished writing.\n' +
  '- It gives feedback by pointing at your own sentences and asking questions.\n' +
  '- It never writes your thesis, your paragraphs, or your sentences. You are the author of every word.\n' +
  '- It runs only when you press an AI button, using your own key. Nothing is sent automatically.\n' +
  'Ideas that came from the AI stay marked with a small ✦ so you always know which thoughts were yours.'
