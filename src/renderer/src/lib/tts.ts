// Read-aloud via the Web Speech API. No network, no extra dependency.
// Some headless / Linux environments ship no voices; every call guards for that
// so the UI degrades gently rather than throwing.

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export interface SpeakOptions {
  rate?: number
  onEnd?: () => void
  /** Fires as speech crosses word boundaries; charIndex indexes into `text`. */
  onBoundary?: (charIndex: number) => void
}

export function speak(text: string, opts: SpeakOptions = {}): boolean {
  if (!ttsSupported()) return false
  const trimmed = text.trim()
  if (!trimmed) return false

  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(trimmed)
  u.rate = Math.max(0.5, Math.min(2, opts.rate ?? 1))
  u.pitch = 1
  u.onend = () => opts.onEnd?.()
  u.onerror = () => opts.onEnd?.()
  if (opts.onBoundary) u.onboundary = (e) => opts.onBoundary?.(e.charIndex)
  window.speechSynthesis.speak(u)
  return true
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel()
}

export function isSpeaking(): boolean {
  return ttsSupported() && window.speechSynthesis.speaking
}
