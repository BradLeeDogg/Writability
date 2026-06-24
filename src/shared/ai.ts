// Pure, offline helpers for the opt-in AI features. The prompt builders and
// model list live here (dependency-free, unit-testable); the actual network
// call lives in the main process (src/main/services/ai.ts) and only ever runs
// when the student clicks an AI button with their own key configured.

export type AiTask = 'paraphrase' | 'tone'

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
  { id: 'claude-haiku-4-5', label: 'Fastest & cheapest', note: 'Great for quick rewrites (Haiku)' }
]

export const DEFAULT_AI_MODEL = 'claude-opus-4-8'

export function isValidModel(id: string): boolean {
  return AI_MODELS.some((m) => m.id === id)
}

const PARAPHRASE_SYSTEM =
  'You are a kind, encouraging writing tutor for students, including many who ' +
  'are dyslexic or have ADHD. Rewrite the student\'s text so it is clearer and ' +
  'easier to read, keeping their meaning and their own voice. Use plain words ' +
  'and shorter sentences. Do not add new ideas or facts. Respond with ONLY the ' +
  'rewritten text — no preamble, no quotation marks, no explanation.'

const TONE_SYSTEM =
  'You are a supportive writing tutor. In 2–3 short, plain sentences, describe ' +
  'the tone of the student\'s text (for example: formal, casual, confident, ' +
  'tentative, friendly). Then suggest one specific, gentle way they could adjust ' +
  'it for an academic essay, if needed. Be warm and concrete. Do not rewrite the ' +
  'whole text.'

export function buildPrompt(task: AiTask, text: string): AiPrompt {
  const user = text.trim()
  if (task === 'tone') return { system: TONE_SYSTEM, user }
  return { system: PARAPHRASE_SYSTEM, user }
}
