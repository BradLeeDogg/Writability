import { useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { coachContext } from '@shared/coach'
import type { Card } from '@shared/types'

// A visual planning board (corkboard). Ideas live as sticky notes the student
// can drag into an order that makes sense to them — built for non-linear and
// visual thinkers. Two views share the same cards:
//   • Free   — a spatial corkboard you arrange by hand.
//   • By part — columns, one per outline section, so you can sort each idea
//               into the part of the paper it belongs to and see what's still
//               empty ("what goes in the Introduction?").
// Either way, "→ Outline" drops a card under its section, closing the loop
// from idea → plan → page.
export function Board(): JSX.Element {
  const current = useStore((s) => s.current)!
  const cards = current.content.cards
  const sections = current.content.outline.map((n) => ({ id: n.id, label: n.label }))
  const addCard = useStore((s) => s.addCard)
  const addCardsFromText = useStore((s) => s.addCardsFromText)
  const updateCardText = useStore((s) => s.updateCardText)
  const updateCardSection = useStore((s) => s.updateCardSection)
  const cycleCardColor = useStore((s) => s.cycleCardColor)
  const moveCard = useStore((s) => s.moveCard)
  const removeCard = useStore((s) => s.removeCard)
  const sendCardToOutline = useStore((s) => s.sendCardToOutline)
  const aiKey = useStore((s) => s.settings.aiApiKey)
  const runAi = useStore((s) => s.runAi)

  const [byPart, setByPart] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [live, setLive] = useState<{ id: string; x: number; y: number } | null>(null)

  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const [aiError, setAiError] = useState('')

  const aiConfigured = !!(aiKey && aiKey.trim())
  const ctx = coachContext(current.content)

  // Drag-to-sort between "By part" columns. Native HTML5 DnD; the section
  // <select> stays as the keyboard-accessible way to do the same thing.
  const draggingId = useRef<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const onCardDragStart = (e: React.DragEvent, cardId: string): void => {
    draggingId.current = cardId
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', cardId)
  }
  const onColumnDragOver = (e: React.DragEvent, colKey: string): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== colKey) setDragOverCol(colKey)
  }
  const onColumnDrop = (e: React.DragEvent, sectionId: string): void => {
    e.preventDefault()
    const id = draggingId.current || e.dataTransfer.getData('text/plain')
    if (id) updateCardSection(id, sectionId || undefined)
    draggingId.current = null
    setDragOverCol(null)
  }
  const clearDrag = (): void => {
    draggingId.current = null
    setDragOverCol(null)
  }

  // Drop one of the student's own pieces of work into the brainstorm box.
  const boardSeedFrom = (value: string): void => {
    setTopic((prev) => (prev.trim() ? prev.trim() + ' ' + value : value))
  }

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

  // A compact "which part of the paper does this belong to" picker.
  const SectionSelect = ({ card }: { card: Card }): JSX.Element => (
    <select
      className="card-section"
      value={card.section ?? ''}
      aria-label="Which part of the paper this idea belongs to"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => updateCardSection(card.id, e.target.value || undefined)}
    >
      <option value="">Unsorted</option>
      {sections.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  )

  return (
    <section className="board" data-testid="board" aria-label="Planning board">
      <div className="board-bar">
        <button className="primary" data-testid="add-card" onClick={() => addCard('')}>
          + Add card
        </button>
        <button
          className={'ghost' + (byPart ? ' active' : '')}
          data-testid="board-view-toggle"
          aria-pressed={byPart}
          onClick={() => setByPart((v) => !v)}
          title="Switch between a free corkboard and columns by part of the paper"
        >
          {byPart ? '🧩 Free board' : '▤ By part'}
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
            {ctx.thesis && (
              <button
                className="chip"
                data-testid="board-seed-thesis"
                onClick={() => boardSeedFrom(ctx.thesis)}
                title="Brainstorm around your thesis"
              >
                + my thesis
              </button>
            )}
            {ctx.assignment && (
              <button
                className="chip"
                data-testid="board-seed-assignment"
                onClick={() => boardSeedFrom(ctx.assignment)}
                title="Brainstorm from the assignment"
              >
                + my assignment
              </button>
            )}
          </div>
        )}
        <span className="board-hint muted">
          {byPart
            ? 'Sort each idea into the part of the paper it belongs to.'
            : 'Drag cards to arrange them; send the keepers to your outline.'}
        </span>
      </div>

      {aiError && (
        <p className="ai-error" role="alert">
          {aiError}
        </p>
      )}

      {byPart ? (
        <div className="board-columns" data-testid="board-columns">
          {[...sections, { id: '', label: 'Unsorted' }].map((col) => {
            const colKey = col.id || 'unsorted'
            const colCards = cards.filter((c) => (c.section ?? '') === col.id)
            return (
              <div
                className={'board-column' + (dragOverCol === colKey ? ' drag-over' : '')}
                key={colKey}
                data-testid="board-column"
                onDragOver={(e) => onColumnDragOver(e, colKey)}
                onDrop={(e) => onColumnDrop(e, col.id)}
              >
                <div className="board-column-head">
                  <span>{col.label}</span>
                  <span className="board-column-count">{colCards.length}</span>
                </div>
                <div className="board-column-body">
                  {colCards.length === 0 && (
                    <p className="muted small">Drag an idea here — what goes in “{col.label}”?</p>
                  )}
                  {colCards.map((card) => (
                    <div className={'lane-card card-' + card.color} key={card.id} data-testid="board-card">
                      <div className="lane-card-head">
                        <span
                          className="lane-grip"
                          data-testid="card-grip"
                          draggable
                          onDragStart={(e) => onCardDragStart(e, card.id)}
                          onDragEnd={clearDrag}
                          title="Drag to another part"
                          aria-hidden="true"
                        >
                          ⠿
                        </span>
                        <button
                          className="card-remove"
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
                      <div className="lane-card-foot">
                        <SectionSelect card={card} />
                        <button className="card-to-outline" onClick={() => sendCardToOutline(card.id)}>
                          → Outline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="board-canvas" ref={canvasRef} data-testid="board-canvas">
          {cards.length === 0 && (
            <p className="board-empty muted">
              Your board is empty. Add a card, or brainstorm a topic, then drag the ideas into an
              order that makes sense to you.
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
                <div className="card-foot">
                  <SectionSelect card={card} />
                  <button
                    className="card-to-outline"
                    onClick={() => sendCardToOutline(card.id)}
                    title="Add this idea to your outline, under its part"
                  >
                    → Outline
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
