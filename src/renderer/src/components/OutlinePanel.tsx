import { useStore } from '../store/useStore'
import { outlineProgress } from '@shared/outline-templates'
import type { OutlineNode } from '@shared/types'

export function OutlinePanel(): JSX.Element {
  const current = useStore((s) => s.current)!
  const toggleOutline = useStore((s) => s.toggleOutline)
  const progress = outlineProgress(current.content.outline)
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

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
          <OutlineItem key={n.id} node={n} depth={0} />
        ))}
      </ol>
    </aside>
  )
}

interface OutlineItemProps {
  node: OutlineNode
  depth: number
}

function OutlineItem({ node, depth }: OutlineItemProps): JSX.Element {
  const setText = useStore((s) => s.setOutlineText)
  const toggleDone = useStore((s) => s.toggleOutlineDone)

  return (
    <li className={`outline-node depth-${depth}`} data-testid="outline-node" data-kind={node.kind}>
      <label className="outline-check">
        <input
          type="checkbox"
          checked={node.done}
          onChange={() => toggleDone(node.id)}
          aria-label={`Mark "${node.label}" done`}
        />
        <span className="outline-label">{node.label}</span>
      </label>
      <p className="outline-prompt">{node.prompt}</p>
      <textarea
        className="outline-text"
        value={node.text}
        placeholder="Write your notes for this step…"
        rows={2}
        aria-label={`${node.label} notes`}
        onChange={(e) => setText(node.id, e.target.value)}
      />
      {node.children.length > 0 && (
        <ol className="outline-children">
          {node.children.map((c) => (
            <OutlineItem key={c.id} node={c} depth={depth + 1} />
          ))}
        </ol>
      )}
    </li>
  )
}
