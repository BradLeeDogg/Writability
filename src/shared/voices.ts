// Pure helpers for choosing a read-aloud voice. Kept dependency-free (and free
// of DOM types) so they can be unit-tested in the main process; the renderer
// passes real SpeechSynthesisVoice objects, which match VoiceLike structurally.

export interface VoiceLike {
  voiceURI: string
  name: string
  lang: string
  default?: boolean
  localService?: boolean
}

/**
 * Order voices for the picker: the app is English, so English voices come
 * first; offline ("local") voices next (lower latency, and what most students
 * will have); then alphabetical. Returns a new array.
 */
export function sortVoices<T extends VoiceLike>(voices: T[]): T[] {
  return [...voices].sort((a, b) => {
    const aEn = a.lang?.toLowerCase().startsWith('en') ? 0 : 1
    const bEn = b.lang?.toLowerCase().startsWith('en') ? 0 : 1
    if (aEn !== bEn) return aEn - bEn
    const aLocal = a.localService ? 0 : 1
    const bLocal = b.localService ? 0 : 1
    if (aLocal !== bLocal) return aLocal - bLocal
    return a.name.localeCompare(b.name)
  })
}

/**
 * Resolve a saved preference to an available voice. Matches on voiceURI first,
 * then name (more stable across machines). Returns undefined when there's no
 * match or no preference, so the engine falls back to its own default.
 */
export function pickVoice<T extends VoiceLike>(voices: T[], voiceURI?: string): T | undefined {
  if (!voiceURI || voices.length === 0) return undefined
  return voices.find((v) => v.voiceURI === voiceURI) ?? voices.find((v) => v.name === voiceURI)
}
