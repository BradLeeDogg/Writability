import { useRef } from 'react'
import { useStore } from '../store/useStore'
import { AssignmentPanel } from './AssignmentPanel'
import { BrainDumpPanel } from './BrainDumpPanel'
import { ReadingPanel } from './ReadingPanel'
import { ClarityPanel } from './ClarityPanel'
import { CitationsPanel } from './CitationsPanel'
import { SettingsPanel } from './SettingsPanel'

type ToolsTab = 'assignment' | 'braindump' | 'reading' | 'clarity' | 'citations' | 'settings'

const TABS: { id: ToolsTab; label: string }[] = [
  { id: 'assignment', label: 'Assignment' },
  { id: 'braindump', label: 'Brain dump' },
  { id: 'reading', label: 'Understand' },
  { id: 'clarity', label: 'Clarity' },
  { id: 'citations', label: 'Citations' },
  { id: 'settings', label: 'Settings' }
]

export function ToolsPanel(): JSX.Element {
  const tab = useStore((s) => s.toolsTab)
  const setTab = useStore((s) => s.setToolsTab)
  const toggleTools = useStore((s) => s.toggleTools)
  const tablistRef = useRef<HTMLDivElement>(null)

  // Standard tablist keyboard model: arrows move (and select) the focused tab,
  // Home/End jump to the ends. Selection follows focus, as in a vertical list.
  const onTabKeyDown = (e: React.KeyboardEvent): void => {
    const idx = TABS.findIndex((t) => t.id === tab)
    let next = idx
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % TABS.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    const nextId = TABS[next].id
    setTab(nextId)
    tablistRef.current?.querySelector<HTMLButtonElement>(`#tab-${nextId}`)?.focus()
  }

  return (
    <aside className="panel tools" aria-label="Writing tools">
      <div className="tabs" role="tablist" aria-label="Tools" ref={tablistRef}>
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            data-testid={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="tools-tabpanel"
            tabIndex={tab === t.id ? 0 : -1}
            className={'tab' + (tab === t.id ? ' active' : '')}
            onClick={() => setTab(t.id)}
            onKeyDown={onTabKeyDown}
          >
            {t.label}
          </button>
        ))}
        <button className="icon push-end" aria-label="Hide tools" title="Hide tools" onClick={toggleTools}>
          ›
        </button>
      </div>

      <div
        className="tab-body"
        id="tools-tabpanel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
        {tab === 'assignment' && <AssignmentPanel />}
        {tab === 'braindump' && <BrainDumpPanel />}
        {tab === 'reading' && <ReadingPanel />}
        {tab === 'clarity' && <ClarityPanel />}
        {tab === 'citations' && <CitationsPanel />}
        {tab === 'settings' && <SettingsPanel />}
      </div>
    </aside>
  )
}
