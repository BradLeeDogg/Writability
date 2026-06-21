import { useStore } from '../store/useStore'
import { findThesisNode, outlineProgress } from '@shared/outline-templates'
import { checkOnThesis } from '@shared/thesis'
import type { OutlineNode } from '@shared/types'

export function OutlinePanel(): JSX.Element {
  const current = useStore((s) => s.current)!
  const toggleOutline = useStore((s) => s.toggleOutline)
  const addBodyParagraph = useStore((s) => s.addBodyParagraph)
  const progress = outlineProgress(current.content.outline)
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const thesisText = findThesisNode(current.content.outline)?.text ?? ''

  return (
    <aside className="panel outline" data-testid="outline" aria-label="Outline">
      <div className="panel-head">
        <h2>Outline</h2>
        <button className="icon" aria-label="Hide outline" title="Hide outline" onClick={toggleOutline}>
          ‹
        </button>
      </div>

      <div className="progress" aria-label={`${progress.done} of ${progress.total} steps done`}>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-label">
          {progress.done} / {progress.total} steps
        </span>
      </div>

      <ol className="outline-list">
        {current.content.outline.map((n) => (
          <OutlineItem key={n.id} node={n} depth={0} thesisText={thesisText} />
        ))}
      </ol>

      <button
        className="ghost add-paragraph"
        data-testid="add-body-paragraph"
        onClick={addBodyParagraph}
      >
        ＋ Add body paragraph
      </button>
    </aside>
  )
}

interface OutlineItemProps {
  node: OutlineNode
  depth: number
  thesisText: string
}

function OutlineItem({ node, depth, thesisText }: OutlineItemProps): JSX.Element {
  const setText = useStore((s) => s.setOutlineText)
  const toggleDone = useStore((s) => s.toggleOutlineDone)
  const removeNode = useStore((s) => s.removeOutlineNode)

  // Body paragraphs (top-level points) can be removed and get a thesis nudge.
  const isBody = depth === 0 && node.kind === 'point'
  const combined = isBody ? [node.text, ...node.children.map((c) => c.text)].join(' ') : ''
  const nudge = isBody ? checkOnThesis(thesisText, combined) : null
  const offThesis = !!nudge?.checked && !nudge.onThesis

  return (
    <li className={`outline-node depth-${depth}`} data-testid="outline-node" data-kind={node.kind}>
      <div className="outline-row">
        <label className="outline-check">
          <input
            type="checkbox"
            checked={node.done}
            onChange={() => toggleDone(node.id)}
            aria-label={`Mark "${node.label}" done`}
          />
          <span className="outline-label">{node.label}</span>
        </label>
        {isBody && (
          <button
            className="icon danger"
            aria-label={`Remove ${node.label}`}
            title="Remove this paragraph"
            onClick={() => removeNode(node.id)}
          >
            ✕
          </button>
        )}
      </div>
      <p className="outline-prompt">{node.prompt}</p>
      <textarea
        className="outline-text"
        value={node.text}
        placeholder="Write your notes for this step…"
        rows={2}
        aria-label={`${node.label} notes`}
        onChange={(e) => setText(node.id, e.target.value)}
      />
      {offThesis && (
        <p className="thesis-nudge" role="note">
          This point doesn’t seem to mention your thesis yet. Does it connect back?
        </p>
      )}
      {node.children.length > 0 && (
        <ol className="outline-children">
          {node.children.map((c) => (
            <OutlineItem key={c.id} node={c} depth={depth + 1} thesisText={thesisText} />
          ))}
        </ol>
      )}
    </li>
  )
}
