import { useStore } from '../store/useStore'

// A deliberately stakes-free writing surface. Nothing here is spell-checked,
// counted, or run through the clarity checks — the point is to lower the cost of
// getting started when a blank, "graded" page feels impossible.
export function BrainDumpPanel(): JSX.Element {
  const current = useStore((s) => s.current)!
  const setScratch = useStore((s) => s.setScratch)

  return (
    <div className="braindump" data-testid="braindump-panel">
      <p className="panel-intro">
        This is your thinking space. Write messy notes, half-ideas, or a list — in any order. Nothing
        here is checked, counted, or marked. When something feels ready, copy it into your paper.
      </p>
      <textarea
        className="braindump-text"
        data-testid="braindump-text"
        value={current.content.scratch}
        placeholder="Dump anything here. It does not have to be neat or in order…"
        aria-label="Brain dump notes"
        onChange={(e) => setScratch(e.target.value)}
      />
    </div>
  )
}
