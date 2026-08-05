import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'

// Ctrl/Cmd+K command palette: every app action, summoned on demand and gone
// again — discoverability without adding a single piece of permanent chrome.
interface Command {
  id: string
  label: string
  run: () => void
}

export function CommandPalette(): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const current = useStore((s) => s.current)
  const view = useStore((s) => s.view)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
        setQuery('')
        setActive(0)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const commands = useMemo<Command[]>(() => {
    const st = useStore.getState()
    const out: Command[] = []
    const paperOpen = view === 'editor' && !!current
    if (paperOpen) {
      out.push(
        { id: 'read', label: 'Read to me (read the paper aloud)', run: () => st.openReadAloud() },
        { id: 'cite', label: 'Cite a source at the cursor', run: () => st.requestCite() },
        { id: 'focus', label: 'Toggle focus mode', run: () => st.toggleFocus() },
        { id: 'board', label: 'Toggle planning board', run: () => st.toggleBoard() },
        { id: 'outline', label: 'Toggle outline panel', run: () => st.toggleOutline() },
        { id: 'tools', label: 'Toggle tools panel', run: () => st.toggleTools() },
        { id: 'stage-draft', label: 'Switch to Draft (hide review marks)', run: () => st.setMeta({ stage: 'draft' }) },
        { id: 'stage-polish', label: 'Switch to Polish (show review marks)', run: () => st.setMeta({ stage: 'polish' }) },
        { id: 'export-docx', label: 'Export as Word (.docx)', run: () => void st.exportCurrent('docx') },
        { id: 'export-pdf', label: 'Export as PDF', run: () => void st.exportCurrent('pdf') },
        { id: 'export-txt', label: 'Export as plain text', run: () => void st.exportCurrent('txt') },
        { id: 'tab-assignment', label: 'Open Assignment tab', run: () => st.setToolsTab('assignment') },
        { id: 'tab-braindump', label: 'Open Brain dump tab', run: () => st.setToolsTab('braindump') },
        { id: 'tab-reading', label: 'Open Understand tab', run: () => st.setToolsTab('reading') },
        { id: 'tab-clarity', label: 'Open Clarity tab', run: () => st.setToolsTab('clarity') },
        { id: 'tab-spelling', label: 'Open Spelling tab', run: () => st.setToolsTab('spelling') },
        { id: 'tab-citations', label: 'Open Citations tab', run: () => st.setToolsTab('citations') },
        { id: 'tab-settings', label: 'Open Settings tab', run: () => st.setToolsTab('settings') },
        { id: 'back', label: 'Back to your papers', run: () => void st.closePaper() }
      )
    }
    out.push({ id: 'backup', label: 'Back up my papers…', run: () => void st.createBackup() })
    return out
  }, [view, current])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [commands, query])

  if (!open) return null

  const close = (): void => {
    setOpen(false)
    setQuery('')
  }
  const runCommand = (c: Command): void => {
    close()
    c.run()
  }

  return (
    <div className="palette-backdrop" onClick={close}>
      <div
        className="palette"
        role="dialog"
        aria-label="Command palette"
        data-testid="command-palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          data-testid="palette-input"
          value={query}
          placeholder="Type what you want to do…"
          aria-label="Search commands"
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, filtered.length - 1))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            }
            if (e.key === 'Enter' && filtered[active]) runCommand(filtered[active])
          }}
        />
        <ul className="palette-list">
          {filtered.length === 0 && <li className="muted palette-empty">No matching command.</li>}
          {filtered.map((c, i) => (
            <li key={c.id}>
              <button
                className={'palette-item' + (i === active ? ' active' : '')}
                data-testid={'cmd-' + c.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => runCommand(c)}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="palette-hint muted">↑↓ choose · Enter run · Esc close</p>
      </div>
    </div>
  )
}
