// Read-aloud via the Web Speech API. No network, no extra dependency.
// Some headless / Linux environments ship no voices; every call guards for that
// so the UI degrades gently rather than throwing.

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text: string, rate = 1, onEnd?: () => void): boolean {
  if (!ttsSupported()) return false
  const trimmed = text.trim()
  if (!trimmed) return false

  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(trimmed)
  u.rate = Math.max(0.5, Math.min(2, rate))
  u.pitch = 1
  u.onend = () => onEnd?.()
  u.onerror = () => onEnd?.()
  window.speechSynthesis.speak(u)
  return true
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel()
}

export function isSpeaking(): boolean {
  return ttsSupported() && window.speechSynthesis.speaking
}
