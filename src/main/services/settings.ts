import { readJson, writeJsonAtomic } from './atomic'
import { settingsPath } from './paths'
import { DEFAULT_SETTINGS } from '@shared/types'
import type { AppSettings } from '@shared/types'

export function getSettings(): AppSettings {
  const stored = readJson<Partial<AppSettings>>(settingsPath(), {})
  // Merge over defaults so new settings keys always have a sane value.
  return { ...DEFAULT_SETTINGS, ...stored }
}

export function saveSettings(settings: AppSettings): { ok: true } {
  const merged = { ...DEFAULT_SETTINGS, ...settings }
  writeJsonAtomic(settingsPath(), merged)
  return { ok: true }
}
