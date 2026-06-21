import { useStore } from '../store/useStore'
import { AssignmentPanel } from './AssignmentPanel'
import { ClarityPanel } from './ClarityPanel'
import { CitationsPanel } from './CitationsPanel'
import { SettingsPanel } from './SettingsPanel'

export function ToolsPanel(): JSX.Element {
  const tab = useStore((s) => s.toolsTab)
  const setTab = useStore((s) => s.setToolsTab)
  const toggleTools = useStore((s) => s.toggleTools)

  return (
    <aside className="panel tools" aria-label="Writing tools">
      <div className="tabs" role="tablist" aria-label="Tools">
        <button
          role="tab"
          aria-selected={tab === 'assignment'}
          data-testid="tab-assignment"
          className={'tab' + (tab === 'assignment' ? ' active' : '')}
          onClick={() => setTab('assignment')}
        >
          Assignment
        </button>
        <button
          role="tab"
          aria-selected={tab === 'clarity'}
          data-testid="tab-clarity"
          className={'tab' + (tab === 'clarity' ? ' active' : '')}
          onClick={() => setTab('clarity')}
        >
          Clarity
        </button>
        <button
          role="tab"
          aria-selected={tab === 'citations'}
          data-testid="tab-citations"
          className={'tab' + (tab === 'citations' ? ' active' : '')}
          onClick={() => setTab('citations')}
        >
          Citations
        </button>
        <button
          role="tab"
          aria-selected={tab === 'settings'}
          data-testid="tab-settings"
          className={'tab' + (tab === 'settings' ? ' active' : '')}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
        <button className="icon push-end" aria-label="Hide tools" title="Hide tools" onClick={toggleTools}>
          ›
        </button>
      </div>

      <div className="tab-body">
        {tab === 'assignment' && <AssignmentPanel />}
        {tab === 'clarity' && <ClarityPanel />}
        {tab === 'citations' && <CitationsPanel />}
        {tab === 'settings' && <SettingsPanel />}
      </div>
    </aside>
  )
}
