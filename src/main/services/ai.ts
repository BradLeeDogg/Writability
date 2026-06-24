import Anthropic from '@anthropic-ai/sdk'
import { buildPrompt, DEFAULT_AI_MODEL, isValidModel } from '@shared/ai'
import { getSettings } from './settings'
import type { AiRunInput, AiRunResult } from '@shared/api'

// The only place in Writability that talks to a network. It runs solely when
// the renderer invokes 'ai:run' (i.e. the student clicked an AI button) and a
// key is configured. The actual call is behind an injectable completer so the
// self-test can exercise the orchestration and error handling fully offline.

export interface CompleteArgs {
  apiKey: string
  model: string
  system: string
  user: string
}

export type Completer = (args: CompleteArgs) => Promise<string>

const realCompleter: Completer = async ({ apiKey, model, system, user }) => {
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: user }]
  })
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

export async function runAiTask(
  input: AiRunInput,
  complete: Completer = realCompleter
): Promise<AiRunResult> {
  const text = (input?.text ?? '').trim()
  if (!text) return { ok: false, error: 'Type or paste some text first.' }

  const settings = getSettings()
  const apiKey = (settings.aiApiKey ?? '').trim()
  if (!apiKey) {
    return { ok: false, error: 'Add your Claude API key in Settings to use AI help.' }
  }
  const model = isValidModel(settings.aiModel) ? settings.aiModel : DEFAULT_AI_MODEL
  const { system, user } = buildPrompt(input.task, text)

  try {
    const out = (await complete({ apiKey, model, system, user })).trim()
    if (!out) return { ok: false, error: 'The AI did not return anything. Please try again.' }
    return { ok: true, text: out }
  } catch (err) {
    return { ok: false, error: friendlyError(err) }
  }
}

function friendlyError(err: unknown): string {
  const e = err as { status?: number; message?: string }
  switch (e?.status) {
    case 401:
    case 403:
      return 'That API key was not accepted. Please check it in Settings.'
    case 429:
      return 'The AI service is busy right now (rate limited). Wait a moment and try again.'
    case 400:
      return 'The request was rejected: ' + (e.message ?? 'bad request') + '.'
    default:
      if (e?.status && e.status >= 500) return 'The AI service had a problem. Please try again.'
      return 'Could not reach the AI service. Check your internet connection.'
  }
}
