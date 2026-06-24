import { useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import type { Card } from '@shared/types'

// A visual planning board (corkboard). Ideas live as sticky notes the student
// can drag into an order that makes sense to them — built for non-linear and
// visual thinkers. Cards can come from an AI brainstorm, and any card can be
// sent to the outline so they can see *where* each idea belongs.
export function Board(): JSX.Element {
  const current = useStore((s) => s.current)!
  const cards = current.content.cards
  const addCard = useStore((s) => s.addCard)
  const addCardsFromText = useStore((s) => s.addCardsFromText)
  const updateCardText = useStore((s) => s.updateCardText)
  const cycleCardColor = useStore((s) => s.cycleCardColor)
  const moveCard = useStore((s) => s.moveCard)
  const removeCard = useStore((s) => s.removeCard)
  const sendCardToOutline = useStore((s) => s.sendCardToOutline)
  const aiKey = useStore((s) => s.settings.aiApiKey)
  const runAi = useStore((s) => s.runAi)

  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [live, setLive] = useState<{ id: string; x: number; y: number } | null>(null)

  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const [aiError, setAiError] = useState('')

  const aiConfigured = !!(aiKey && aiKey.trim())

  const onPointerDown = (e: React.PointerEvent, card: Card): void => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { id: card.id, offsetX: e.clientX - rect.left - card.x, offsetY: e.clientY - rect.top - card.y }
    setLive({ id: card.id, x: card.x, y: card.y })
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    const d = dragRef.current
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!d || !rect) return
    const x = Math.max(0, Math.round(e.clientX - rect.left - d.offsetX))
    const y = Math.max(0, Math.round(e.clientY - rect.top - d.offsetY))
    setLive({ id: d.id, x, y })
  }
  const onPointerUp = (): void => {
    const d = dragRef.current
    if (d && live && live.id === d.id) moveCard(d.id, live.x, live.y)
    dragRef.current = null
    setLive(null)
  }

  const onBrainstorm = async (): Promise<void> => {
    const value = topic.trim()
    if (!value || busy) return
    setBusy(true)
    setAiError('')
    const res = await runAi({ task: 'brainstorm', text: value })
    setBusy(false)
    if (res.ok) {
      addCardsFromText(res.text ?? '')
      setTopic('')
    } else {
      setAiError(res.error ?? 'Something went wrong.')
    }
  }

  const posOf = (card: Card): { x: number; y: number } =>
    live && live.id === card.id ? { x: live.x, y: live.y } : { x: card.x, y: card.y }

  return (
    <section className="board" data-testid="board" aria-label="Planning board">
      <div className="board-bar">
        <button className="primary" data-testid="add-card" onClick={() => addCard('')}>
          + Add card
        </button>
        {aiConfigured && (
          <div className="board-ai">
            <input
              className="board-ai-input"
              data-testid="board-ai-input"
              value={topic}
              placeholder="Brainstorm a topic into cards…"
              aria-label="Topic to brainstorm into cards"
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onBrainstorm()
              }}
            />
            <button
              className="ghost"
              data-testid="board-brainstorm"
              disabled={busy}
              onClick={() => void onBrainstorm()}
            >
              {busy ? 'Thinking…' : '💡 Brainstorm'}
            </button>
          </div>
        )}
        <span className="board-hint muted">Drag cards to arrange them; send the keepers to your outline.</span>
      </div>

      {aiError && (
        <p className="ai-error" role="alert">
          {aiError}
        </p>
      )}

      <div className="board-canvas" ref={canvasRef} data-testid="board-canvas">
        {cards.length === 0 && (
          <p className="board-empty muted">
            Your board is empty. Add a card, or brainstorm a topic, then drag the ideas into an order
            that makes sense to you.
          </p>
        )}
        {cards.map((card) => {
          const p = posOf(card)
          return (
            <div
              key={card.id}
              className={'card card-' + card.color}
              data-testid="board-card"
              style={{ left: p.x, top: p.y }}
            >
              <div
                className="card-handle"
                onPointerDown={(e) => onPointerDown(e, card)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                aria-label="Drag to move card"
                title="Drag to move"
              >
                <button
                  className="card-color"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => cycleCardColor(card.id)}
                  aria-label="Change colour"
                  title="Change colour"
                >
                  ●
                </button>
                <button
                  className="card-remove"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeCard(card.id)}
                  aria-label="Delete card"
                  title="Delete card"
                >
                  ×
                </button>
              </div>
              <textarea
                className="card-text"
                value={card.text}
                placeholder="Write an idea…"
                aria-label="Card text"
                onChange={(e) => updateCardText(card.id, e.target.value)}
              />
              <button className="card-to-outline" onClick={() => sendCardToOutline(card.id)}>
                → Outline
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
