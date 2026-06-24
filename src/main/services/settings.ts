import { safeStorage } from 'electron'
import { readJson, writeJsonAtomic } from './atomic'
import { settingsPath } from './paths'
import { DEFAULT_SETTINGS } from '@shared/types'
import type { AppSettings } from '@shared/types'

// On disk we never want the Claude API key sitting in plaintext. When the OS
// keychain is available (DPAPI on Windows, Keychain on macOS, libsecret on
// Linux) we encrypt the key with Electron's safeStorage and persist only the
// ciphertext. Where no keychain exists (some headless Linux) we fall back to
// the previous plaintext behaviour so the app keeps working.
interface StoredSettings extends Partial<AppSettings> {
  /** Base64 ciphertext of aiApiKey, encrypted with the OS keychain. */
  aiKeyEnc?: string
}

export function encryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function getSettings(): AppSettings {
  const stored = readJson<StoredSettings>(settingsPath(), {})
  const { aiKeyEnc, ...rest } = stored
  const settings = { ...DEFAULT_SETTINGS, ...rest } as AppSettings
  if (aiKeyEnc && encryptionAvailable()) {
    try {
      settings.aiApiKey = safeStorage.decryptString(Buffer.from(aiKeyEnc, 'base64'))
    } catch {
      // Ciphertext from another machine/user can't be decrypted here — drop it.
      settings.aiApiKey = ''
    }
  }
  return settings
}

export function saveSettings(settings: AppSettings): { ok: true } {
  // settings carries the in-memory plaintext; merged is what we persist.
  const merged: StoredSettings = { ...DEFAULT_SETTINGS, ...settings }
  const key = (merged.aiApiKey ?? '').trim()
  if (key && encryptionAvailable()) {
    try {
      merged.aiKeyEnc = safeStorage.encryptString(key).toString('base64')
      delete merged.aiApiKey // never write the plaintext key to disk
    } catch {
      // Encryption unexpectedly failed — leave the plaintext key as a fallback.
    }
  } else if (!key) {
    delete merged.aiKeyEnc
  }
  writeJsonAtomic(settingsPath(), merged)
  return { ok: true }
}
