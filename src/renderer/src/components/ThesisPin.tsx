import { useStore } from '../store/useStore'
import { findThesisNode } from '@shared/outline-templates'

// A slim, always-visible reminder of the thesis, docked above the writing area
// so it never has to be held in working memory while drafting. Editing it here
// updates the same thesis step shown in the outline.
export function ThesisPin(): JSX.Element | null {
  const current = useStore((s) => s.current)!
  const setText = useStore((s) => s.setOutlineText)
  const thesis = findThesisNode(current.content.outline)
  if (!thesis) return null

  return (
    <div className="thesis-pin" data-testid="thesis-pin">
      <span className="thesis-pin-label">{thesis.label}</span>
      <input
        className="thesis-pin-input"
        value={thesis.text}
        placeholder="Write your one-sentence thesis here — every paragraph points back to it."
        aria-label="Your thesis, kept in view"
        onChange={(e) => setText(thesis.id, e.target.value)}
      />
    </div>
  )
}
