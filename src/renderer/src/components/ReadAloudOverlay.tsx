import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { docToPlainText, splitSentences, sentenceIndexAt } from '@shared/doc'
import { speak, stopSpeaking, ttsSupported } from '../lib/tts'

// Immersive "Read to me" mode. A calm, full-screen reader that uses the
// student's own font/size/spacing and highlights each sentence as it is
// spoken — multi-sensory reading (see + hear) is one of the strongest
// supports for dyslexic and ADHD readers. Fully offline (Web Speech API);
// if a device has no voices it still shows the text to read along to.
export function ReadAloudOverlay(): JSX.Element | null {
  const open = useStore((s) => s.readAloudOpen)
  const close = useStore((s) => s.closeReadAloud)
  const doc = useStore((s) => s.current?.content.doc)
  const ttsRate = useStore((s) => s.settings.ttsRate)

  const text = useMemo(() => docToPlainText(doc), [doc])
  const sentences = useMemo(() => splitSentences(text), [text])
  const [active, setActive] = useState(0)
  const activeRef = useRef<HTMLSpanElement>(null)

  const start = (): void => {
    setActive(0)
    speak(text, {
      rate: ttsRate,
      onBoundary: (charIndex) => setActive(sentenceIndexAt(sentences, charIndex))
    })
  }

  // Start reading when the overlay opens; stop on close/unmount.
  useEffect(() => {
    if (!open) return
    start()
    return () => stopSpeaking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Keep the spoken sentence in view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [active])

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
      <div className="reader-page" data-testid="reader-page">
        {sentences.length === 0 && (
          <p className="muted">Nothing to read yet — write something first.</p>
        )}
        {sentences.map((s, i) => (
          <span
            key={s.start}
            ref={i === active ? activeRef : undefined}
            className={'reader-sentence' + (i === active ? ' active' : '')}
            onClick={() => setActive(i)}
          >
            {s.text}{' '}
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
