// Read-aloud via the Web Speech API. No network, no extra dependency.
// Some headless / Linux environments ship no voices; every call guards for that
// so the UI degrades gently rather than throwing.

import { pickVoice } from '@shared/voices'

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Voices the OS has installed (may be empty, or load asynchronously). */
export function listVoices(): SpeechSynthesisVoice[] {
  return ttsSupported() ? window.speechSynthesis.getVoices() : []
}

/** Subscribe to the (often delayed) arrival of voices; returns an unsubscribe. */
export function onVoicesChanged(cb: () => void): () => void {
  if (!ttsSupported()) return () => {}
  window.speechSynthesis.addEventListener('voiceschanged', cb)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', cb)
}

export interface SpeakOptions {
  rate?: number
  /** 0.6–1.4; lower can feel calmer. */
  pitch?: number
  /** Preferred voice (voiceURI); falls back to the engine default if unknown. */
  voiceURI?: string
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
  u.pitch = Math.max(0, Math.min(2, opts.pitch ?? 1))
  const voice = pickVoice(window.speechSynthesis.getVoices(), opts.voiceURI)
  if (voice) u.voice = voice
  u.onend = () => opts.onEnd?.()
  u.onerror = () => opts.onEnd?.()
  if (opts.onBoundary) u.onboundary = (e) => opts.onBoundary?.(e.charIndex)
  window.speechSynthesis.speak(u)
  return true
}

export function pauseSpeaking(): void {
  if (ttsSupported() && window.speechSynthesis.speaking) window.speechSynthesis.pause()
}

export function resumeSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.resume()
}

export function isPaused(): boolean {
  return ttsSupported() && window.speechSynthesis.paused
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel()
}

export function isSpeaking(): boolean {
  return ttsSupported() && window.speechSynthesis.speaking
}
