import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { speak, stopSpeaking, ttsSupported } from '../lib/tts'
import { summarizeSource } from '@shared/reading'

// Paste a dense source paragraph and get oriented: its likely main idea, the
// few most important sentences, the reading level, and a read-aloud button.
export function ReadingPanel(): JSX.Element {
  const ttsRate = useStore((s) => s.settings.ttsRate)
  const ttsPitch = useStore((s) => s.settings.ttsPitch)
  const ttsVoice = useStore((s) => s.settings.ttsVoice)
  const [text, setText] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const showToast = useStore((st) => st.showToast)

  const summary = useMemo(() => summarizeSource(text), [text])
  const hasText = text.trim().length > 0

  const onReadAloud = (): void => {
    if (speaking) {
      stopSpeaking()
      setSpeaking(false)
      return
    }
    const ok = speak(text, {
      rate: ttsRate,
      pitch: ttsPitch,
      voiceURI: ttsVoice,
      onEnd: () => setSpeaking(false)
    })
    setSpeaking(ok)
    if (!ok) showToast('Read-aloud is not available on this device.')
  }

  return (
    <div className="reading" data-testid="reading-panel">
      <p className="panel-intro">
        Paste a hard paragraph from a source. Writability will point out the likely main idea and
        the most important sentences, so you can get your bearings before you read it all.
      </p>

      <textarea
        className="reading-input"
        data-testid="reading-input"
        value={text}
        rows={6}
        aria-label="Source text to understand"
        placeholder="Paste a paragraph from an article, book, or website here…"
        onChange={(e) => setText(e.target.value)}
      />

      {ttsSupported() && hasText && (
        <button
          className={'ghost block' + (speaking ? ' active' : '')}
          aria-pressed={speaking}
          onClick={onReadAloud}
        >
          {speaking ? '◼ Stop reading' : '🔊 Read this aloud'}
        </button>
      )}

      {!hasText ? (
        <p className="muted">Paste some text above to see a plain-language breakdown.</p>
      ) : (
        <div className="reading-result" data-testid="reading-result">
          <section className="reading-block">
            <h3>The main idea looks like</h3>
            <p className="reading-claim">{summary.mainClaim}</p>
          </section>

          {summary.keySentences.length > 1 && (
            <section className="reading-block">
              <h3>Most important sentences</h3>
              <ul className="reading-key">
                {summary.keySentences.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          <p className="reading-stats">
            {summary.wordCount} words · {summary.sentenceCount} sentences · {summary.readingLabel}
          </p>
        </div>
      )}
    </div>
  )
}
