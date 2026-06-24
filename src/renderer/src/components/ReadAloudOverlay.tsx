import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { docToPlainText, splitSentences, splitWords, sentenceIndexAt, wordIndexAt } from '@shared/doc'
import { speak, stopSpeaking, ttsSupported } from '../lib/tts'

// Immersive "Read to me" mode. A calm, full-screen reader that uses the
// student's own font/size/spacing and highlights each *word* as it is spoken,
// with the current sentence gently tinted — multi-sensory reading (see + hear)
// is one of the strongest supports for dyslexic and ADHD readers. Click any
// word to start reading from there. Fully offline (Web Speech API); if a
// device has no voices it still shows the text to read along to.
export function ReadAloudOverlay(): JSX.Element | null {
  const open = useStore((s) => s.readAloudOpen)
  const close = useStore((s) => s.closeReadAloud)
  const doc = useStore((s) => s.current?.content.doc)
  const ttsRate = useStore((s) => s.settings.ttsRate)
  const ttsPitch = useStore((s) => s.settings.ttsPitch)
  const ttsVoice = useStore((s) => s.settings.ttsVoice)

  const text = useMemo(() => docToPlainText(doc), [doc])
  const sentences = useMemo(() => splitSentences(text), [text])
  const words = useMemo(() => splitWords(text), [text])
  // Group words under their sentence once, so each render is linear.
  const grouped = useMemo(() => {
    const g: { w: (typeof words)[number]; wi: number }[][] = sentences.map(() => [])
    words.forEach((w, wi) => {
      const si = sentenceIndexAt(sentences, w.start)
      if (g[si]) g[si].push({ w, wi })
    })
    return g
  }, [words, sentences])

  const [activeWord, setActiveWord] = useState(0)
  const activeSentence = words[activeWord] ? sentenceIndexAt(sentences, words[activeWord].start) : 0
  const activeRef = useRef<HTMLSpanElement>(null)

  // Speak from a character offset; word boundaries are reported relative to the
  // spoken substring, so add the offset back to land on the right global word.
  const speakFrom = (charIndex: number): void => {
    setActiveWord(wordIndexAt(words, charIndex))
    speak(text.slice(charIndex), {
      rate: ttsRate,
      pitch: ttsPitch,
      voiceURI: ttsVoice,
      onBoundary: (ci) => setActiveWord(wordIndexAt(words, charIndex + ci))
    })
  }
  const start = (): void => speakFrom(0)

  // Start reading when the overlay opens; stop on close/unmount.
  useEffect(() => {
    if (!open) return
    start()
    return () => stopSpeaking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Keep the spoken line in view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeSentence])

  // Escape closes.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  // Click a word (event-delegated) to start reading from there.
  const onWordClick = (e: React.MouseEvent): void => {
    const el = (e.target as HTMLElement).closest('[data-wi]') as HTMLElement | null
    if (!el) return
    const wi = Number(el.dataset.wi)
    if (Number.isFinite(wi) && words[wi]) speakFrom(words[wi].start)
  }

  return (
    <div className="reader-overlay" data-testid="read-aloud-overlay" role="dialog" aria-label="Read aloud">
      <div className="reader-bar">
        <span className="reader-title">Reading to you</span>
        <div className="reader-controls">
          <button className="ghost" data-testid="reader-restart" onClick={start}>
            ↻ Start over
          </button>
          <button className="primary" data-testid="reader-close" onClick={close}>
            ◼ Done
          </button>
        </div>
      </div>
      <div className="reader-page" data-testid="reader-page" onClick={onWordClick}>
        {sentences.length === 0 && (
          <p className="muted">Nothing to read yet — write something first.</p>
        )}
        {sentences.map((s, si) => (
          <span
            key={s.start}
            ref={si === activeSentence ? activeRef : undefined}
            className={'reader-sentence' + (si === activeSentence ? ' current' : '')}
          >
            {grouped[si].map(({ w, wi }) => (
              <span
                key={w.start}
                data-wi={wi}
                className={'reader-word' + (wi === activeWord ? ' active' : '')}
              >
                {w.text}{' '}
              </span>
            ))}
          </span>
        ))}
      </div>
      {!ttsSupported() && (
        <p className="reader-note muted">
          This device has no built-in voice, so there’s no audio — but you can still read along.
        </p>
      )}
    </div>
  )
}
